import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/GameContext';
import { getScene } from '../engine/story';
import { getAdventure, getCharacter, toHero, makeHeroAttackLookup, heroDisplayName } from '../engine/party';
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant, clone, enemyIntent, performTaunt, performMark, TACTIC_USES } from '../engine/combat';
import { applyPower, getPower } from '../engine/powers';
import { applyItem, rollLoot, getItem } from '../engine/items';
import { getRelic } from '../engine/relics';
import { activeStatuses } from '../engine/status';
import { isHandoffOn } from '../ui/handoff';
import { scaleEnemies, restHp, effectiveMaxHp, levelPowerBonus } from '../engine/difficulty';
import { defaultRng } from '../engine/rng';
import { hpColor, shakeIntensity, prefersReducedMotion } from '../ui/visuals';
import { sfx } from '../ui/sfx';
import type { CombatState, Power, Item, AttackEvent } from '../types';
import { CombatDice } from './CombatDice';

interface Flash { id: string; amount: number; heal: boolean; nonce: number; }

export function CombatView() {
  const { state, dispatch } = useGame();
  const adventure = getAdventure(state.adventureId);
  const scene = getScene(adventure, state.sceneId);
  const level = state.campaign?.level ?? 1;

  const lookup = useMemo(() => makeHeroAttackLookup(state.partyIds), [state.partyIds]);

  const [combat, setCombat] = useState<CombatState>(() => {
    if (scene.type !== 'combat') throw new Error('CombatView requires a combat scene');
    const heroes = state.partyIds.map((id) => {
      const c = getCharacter(id);
      return toHero(id, state.hp[id] ?? effectiveMaxHp(c, state.difficulty, level), state.relics[id] ?? []);
    });
    heroes.forEach((h) => { h.maxHp = effectiveMaxHp(getCharacter(h.id), state.difficulty, level); });
    heroes.forEach((h) => { h.name = heroDisplayName(h.id, state.playerNames); });
    const enemies = scaleEnemies(scene.enemies, state.difficulty, state.partyIds.length, level);
    return startCombat(heroes, enemies, defaultRng);
  });

  const [target, setTarget] = useState<string | null>(null);
  const [pendingPower, setPendingPower] = useState<Power | null>(null);
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [handoffDoneFor, setHandoffDoneFor] = useState<string | null>(null);
  const [pendingMark, setPendingMark] = useState(false);
  const [tacticUses, setTacticUses] = useState<Record<string, number>>(() => {
    const u: Record<string, number> = {};
    state.partyIds.forEach((id) => { u[id] = TACTIC_USES; });
    return u;
  });
  const [flash, setFlash] = useState<Flash | null>(null);
  const mounted = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { mounted.current = false; }, []);

  // Impact feedback: damage-scaled screen shake + a crit flash, gated by reduced-motion.
  function playJuice(ev: AttackEvent) {
    if (prefersReducedMotion()) { if (ev.crit) sfx.crit(); return; }
    const px = shakeIntensity(ev.amount, ev.crit);
    const el = rootRef.current;
    if (el && typeof el.animate === 'function' && px > 0) {
      el.animate(
        [
          { transform: 'translate(0,0)' },
          { transform: `translate(${px}px, ${-px}px)` },
          { transform: `translate(${-px}px, ${px}px)` },
          { transform: `translate(${Math.round(px / 2)}px, 0)` },
          { transform: 'translate(0,0)' },
        ],
        { duration: 280, easing: 'ease-out' },
      );
    }
    if (ev.crit) {
      sfx.crit();
      const f = flashRef.current;
      if (f && typeof f.animate === 'function') {
        f.animate([{ opacity: 0 }, { opacity: 0.32 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
      }
    }
  }

  // Per-hero remaining uses of that hero's own power.
  const [powerUses, setPowerUses] = useState<Record<string, number>>(() => {
    const u: Record<string, number> = {};
    state.partyIds.forEach((id) => {
      const pid = getCharacter(id).powerId;
      if (pid) u[id] = getPower(pid).uses + levelPowerBonus(level);
    });
    return u;
  });

  if (scene.type !== 'combat') return null;

  const actor = currentCombatant(combat);
  const livingEnemies = combat.combatants.filter((c) => !c.isHero && c.hp > 0);
  const frontLineAlive = combat.combatants.some((c) => c.isHero && c.hp > 0 && !c.backLine);
  const heroChar = actor.isHero ? getCharacter(actor.heroId!) : null;
  const power = heroChar?.powerId ? getPower(heroChar.powerId) : null;
  const usesLeft = power ? (powerUses[actor.id] ?? 0) : 0;
  const selectingEnemy = pendingPower?.targeting === 'enemy' || pendingItem?.targeting === 'enemy' || pendingMark;
  const selectingAlly = pendingPower?.targeting === 'ally' || pendingItem?.targeting === 'ally';
  const stash = Object.entries(state.inventory).filter(([, n]) => n > 0);
  const stashCount = stash.reduce((sum, [, n]) => sum + n, 0);
  const handoffNeeded = actor.isHero && handoffDoneFor !== actor.id && isHandoffOn();

  function applyResult(next: CombatState) {
    const ev = next.lastAttack;
    if (ev && ev.amount > 0) {
      if (ev.kind === 'heal') sfx.click(); else { sfx.hit(); playJuice(ev); }
      setFlash({ id: ev.targetId, amount: ev.amount, heal: ev.kind === 'heal', nonce: Date.now() });
      setTimeout(() => { if (mounted.current) setFlash(null); }, 850);
    }

    // Count heroes that dropped this action (were up in `combat`, down in `next`).
    const downed = next.combatants.filter(
      (c) => c.isHero && c.hp <= 0 && (combat.combatants.find((p) => p.id === c.id)?.hp ?? 0) > 0,
    ).length;
    if (downed > 0) dispatch({ type: 'RECORD', delta: { heroesDowned: downed } });

    setCombat(next);

    const hp: Record<string, number> = {};
    next.combatants.filter((c) => c.isHero).forEach((c) => { hp[c.heroId!] = c.hp; });
    dispatch({ type: 'SET_HP', hp });

    if (next.status !== 'active' && scene.type === 'combat') {
      next.log.forEach((entry) => dispatch({ type: 'LOG', entry }));
      if (next.status === 'victory') {
        dispatch({ type: 'RECORD', delta: { encountersWon: 1 } });
        const healed: Record<string, number> = {};
        next.combatants.filter((c) => c.isHero).forEach((c) => {
          healed[c.heroId!] = restHp(c.hp, c.maxHp, state.difficulty);
        });
        dispatch({ type: 'SET_HP', hp: healed });
        const gained = Object.keys(healed).some((id) => healed[id] > (hp[id] ?? 0));
        if (gained) dispatch({ type: 'LOG', entry: 'The party catches their breath and binds their wounds.' });
        const drop = rollLoot(defaultRng, state.difficulty);
        if (drop) {
          dispatch({ type: 'ADD_ITEM', itemId: drop, delta: 1 });
          dispatch({ type: 'LOG', entry: `You loot a ${getItem(drop).name}!` });
        }
        setTimeout(() => dispatch({ type: 'GOTO_SCENE', sceneId: scene.onVictory }), 700);
      } else {
        setTimeout(() => dispatch({ type: 'GOTO_SCENE', sceneId: scene.onDefeat }), 700);
      }
    }
  }

  function recordHeroDamage(heroId: string, next: CombatState) {
    const ev = next.lastAttack;
    if (ev && ev.kind === 'attack' && ev.amount > 0) {
      dispatch({ type: 'RECORD', delta: { damageByHero: { [heroId]: ev.amount }, biggestHit: ev.amount, crits: ev.crit ? 1 : 0 } });
    }
  }

  function heroAttack(attackName: string) {
    if (!target) return;
    sfx.click();
    const next = performHeroAttack(combat, actor.id, attackName, target, defaultRng, lookup);
    recordHeroDamage(actor.heroId!, next);
    applyResult(next);
    setTarget(null);
  }

  function resolvePower(targetIds: string[]) {
    if (!power) return;
    sfx.click();
    setPowerUses((u) => ({ ...u, [actor.id]: (u[actor.id] ?? 0) - 1 }));
    setPendingPower(null);
    setTarget(null);
    const next = applyPower(combat, actor.id, power.id, targetIds, defaultRng, lookup);
    recordHeroDamage(actor.heroId!, next);
    applyResult(next);
  }

  function consumeItem(item: Item, targetIds: string[]) {
    sfx.click();
    dispatch({ type: 'ADD_ITEM', itemId: item.id, delta: -1 });
    setPendingItem(null);
    setItemMenuOpen(false);
    setTarget(null);
    const next = applyItem(combat, actor.id, item.id, targetIds, defaultRng);
    recordHeroDamage(actor.heroId!, next);
    applyResult(next);
  }

  function chooseItem(item: Item) {
    sfx.click();
    if (item.targeting === 'all-enemies') { consumeItem(item, []); return; }
    setItemMenuOpen(false);
    setPendingItem(item); // ally / enemy -> enter targeting
  }

  function spendLuckAdvantage() {
    if (state.luck <= 0 || actor.nextAttack) return;
    sfx.click();
    dispatch({ type: 'SPEND_LUCK' });
    setCombat((c) => {
      const next = clone(c);
      const a = next.combatants.find((x) => x.id === actor.id);
      if (a) a.nextAttack = 'adv';
      return next;
    });
  }

  function nameOf(id: string): string {
    const c = combat.combatants.find((x) => x.id === id);
    if (!c) return '';
    return c.isHero ? heroDisplayName(c.heroId!, state.playerNames) : c.name;
  }

  function doTaunt() {
    sfx.click();
    setTacticUses((u) => ({ ...u, [actor.id]: (u[actor.id] ?? 0) - 1 }));
    applyResult(performTaunt(combat, actor.id));
  }

  function markFoe(enemyId: string) {
    sfx.click();
    setPendingMark(false);
    setTacticUses((u) => ({ ...u, [actor.id]: (u[actor.id] ?? 0) - 1 }));
    applyResult(performMark(combat, actor.id, enemyId));
  }

  function choosePower() {
    if (!power) return;
    sfx.click();
    if (power.targeting === 'self') { resolvePower([actor.id]); return; }
    if (power.targeting === 'all-enemies') { resolvePower([]); return; }
    setPendingPower(power);
  }

  function enemyContinue() {
    applyResult(performEnemyTurn(combat, defaultRng));
  }

  function badge(c: { nextAttack?: 'adv' | 'dis' }) {
    if (c.nextAttack === 'adv') return <span className="adv-badge adv" title="Advantage on next attack">⬆</span>;
    if (c.nextAttack === 'dis') return <span className="adv-badge dis" title="Disadvantage on next attack">⬇</span>;
    return null;
  }

  return (
    <div className="app-shell screen" ref={rootRef}>
      <div ref={flashRef} className="crit-flash" aria-hidden />
      <h2 className="display danger-title" style={{ fontSize: '1.7rem' }}>⚔ {scene.title}</h2>
      <div className="rule-accent danger" />
      <p style={{ lineHeight: 1.7, fontSize: '1.08rem' }}>{scene.narration}</p>

      <div className="game-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Foes</h3>
          <div className="stack">
            {combat.combatants.filter((c) => !c.isHero).map((e) => {
              const isFlash = flash?.id === e.id;
              const clickable = e.hp > 0 && actor.isHero && ((!pendingPower && !pendingItem) || selectingEnemy);
              return (
                <button
                  key={e.id}
                  className={`panel combatant${isFlash ? (flash!.heal ? ' heal' : ' hit') : ''}${target === e.id ? ' active-turn' : ''}`}
                  disabled={!clickable}
                  onClick={() => { sfx.click(); if (!selectingEnemy) { setTarget(e.id); } else if (pendingMark) { markFoe(e.id); } else if (pendingItem) { consumeItem(pendingItem, [e.id]); } else { resolvePower([e.id]); } }}
                  style={{ position: 'relative', textAlign: 'left', cursor: clickable ? 'pointer' : 'default', opacity: e.hp <= 0 ? 0.4 : 1, padding: 14 }}
                >
                  {isFlash && <span key={flash!.nonce} className={`dmg-float${flash!.heal ? ' heal' : ''}`}>{flash!.heal ? '+' : '-'}{flash!.amount}</span>}
                  <strong style={{ fontWeight: 600 }}>{e.name} {badge(e)}</strong>
                  {e.hp <= 0 && <span className="faint"> — slain</span>}
                  <div className="hp-bar" style={{ marginTop: 8 }} role="progressbar" aria-label={`${e.name} hit points`} aria-valuenow={e.hp} aria-valuemin={0} aria-valuemax={e.maxHp}>
                    <div className="hp-fill" style={{ width: `${(e.hp / Math.max(1, e.maxHp)) * 100}%`, background: hpColor(e.hp / Math.max(1, e.maxHp)) }} />
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 5, fontSize: '0.82rem' }}>
                    <span className="muted">{e.hp}/{e.maxHp} HP</span>
                    <span className="tag">AC {e.ac}</span>
                    {e.ability && <span className="tag" title={e.ability.description}>✦ {e.ability.name}</span>}
                  </div>
                  {e.hp > 0 && (() => {
                    const intent = enemyIntent(combat, e.id);
                    if (!intent) return null;
                    const txt = intent.kind === 'attack'
                      ? `⚔ → ${nameOf(intent.targetId!)} ·~${intent.estDamage}`
                      : `✦ ${intent.label} → ${nameOf(intent.targetId!)}`;
                    return <div className="tag" style={{ fontSize: '0.74rem', marginTop: 6, display: 'inline-block' }} title="What this foe will do on its turn">{txt}</div>;
                  })()}
                  {e.marked && <span className="tag" style={{ fontSize: '0.72rem', marginTop: 6, marginLeft: 6, display: 'inline-block', color: 'var(--accent-bright)' }}>🎯 Marked</span>}
                  {activeStatuses(e).map((s) => (
                    <span key={s.id} className="tag" style={{ fontSize: '0.72rem', marginTop: 6, marginLeft: 6, display: 'inline-block' }} title={s.id}>{s.icon}{s.turns}</span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '0.95rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>The Party</h3>
          <div className="stack">
            {combat.combatants.filter((c) => c.isHero).map((h) => {
              const isFlash = flash?.id === h.id;
              const allyTargetable = selectingAlly && (h.hp > 0 || pendingItem?.kind === 'heal');
              return (
                <button
                  key={h.id}
                  className={`panel combatant${isFlash ? (flash!.heal ? ' heal' : ' hit') : ''}${actor.id === h.id ? ' active-turn' : ''}`}
                  disabled={!allyTargetable}
                  onClick={() => { if (!allyTargetable) return; if (pendingItem) { consumeItem(pendingItem, [h.id]); } else { resolvePower([h.id]); } }}
                  style={{ position: 'relative', textAlign: 'left', width: '100%', opacity: h.hp <= 0 ? 0.45 : 1, padding: 14, cursor: allyTargetable ? 'pointer' : 'default' }}
                >
                  {isFlash && <span key={flash!.nonce} className={`dmg-float${flash!.heal ? ' heal' : ''}`}>{flash!.heal ? '+' : '-'}{flash!.amount}</span>}
                  <strong style={{ fontWeight: 600 }}>{getCharacter(h.heroId!).portrait} {getCharacter(h.heroId!).name} {badge(h)}</strong>
                  {h.hp <= 0 && <span style={{ color: 'var(--accent-bright)' }}> — down</span>}
                  {state.playerNames[h.heroId!]?.trim() && <div className="faint" style={{ fontSize: '0.72rem' }}>Played by {state.playerNames[h.heroId!]}</div>}
                  <div className="hp-bar" style={{ marginTop: 8 }} role="progressbar" aria-label={`${h.name} hit points`} aria-valuenow={h.hp} aria-valuemin={0} aria-valuemax={h.maxHp}>
                    <div className="hp-fill" style={{ width: `${(h.hp / Math.max(1, h.maxHp)) * 100}%`, background: hpColor(h.hp / Math.max(1, h.maxHp)) }} />
                  </div>
                  <div className="muted" style={{ fontSize: '0.82rem', marginTop: 5 }}>{h.hp}/{h.maxHp} HP</div>
                  {h.backLine && h.hp > 0 && (
                    <div className="tag" style={{ fontSize: '0.72rem', marginTop: 5, display: 'inline-block' }}
                      title={frontLineAlive ? 'At range — enemies attack at disadvantage while the front line holds' : 'Exposed — no front line to screen'}>
                      ⤢ {frontLineAlive ? 'Covered' : 'Exposed'}
                    </div>
                  )}
                  {(state.relics[h.heroId!] ?? []).length > 0 && (
                    <div className="row" style={{ gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                      {(state.relics[h.heroId!] ?? []).map((rid) => (
                        <span key={rid} className="tag" style={{ fontSize: '0.7rem' }} title={getRelic(rid).description}>✦ {getRelic(rid).name}</span>
                      ))}
                    </div>
                  )}
                  {activeStatuses(h).map((s) => (
                    <span key={s.id} className="tag" style={{ fontSize: '0.72rem', marginTop: 6, marginRight: 6, display: 'inline-block' }} title={s.id}>{s.icon}{s.turns}</span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {combat.lastAttack && (
        <div style={{ marginTop: 16 }}>
          <CombatDice event={combat.lastAttack} />
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <p style={{ marginTop: 0 }}>
          <span className="tag" style={{ marginRight: 8 }}>Round {combat.round}</span>
          <strong className="accent-text">{actor.name}</strong>’s turn
          <span className="tag" style={{ marginLeft: 8 }}>✦ Luck {state.luck}</span>
        </p>
        {actor.isHero && heroChar ? (
          handoffNeeded ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                Pass the device to <strong className="accent-text">{actor.name}</strong> — {getCharacter(actor.heroId!).name}'s turn.
              </p>
              <button className="btn btn-primary" onClick={() => { sfx.click(); setHandoffDoneFor(actor.id); }}>I'm ready ▸</button>
            </>
          ) : pendingPower ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                {selectingAlly ? `Choose an ally for ${pendingPower.name}.` : `Choose a foe for ${pendingPower.name}.`}
              </p>
              <button className="btn" onClick={() => { sfx.click(); setPendingPower(null); }}>← Cancel</button>
            </>
          ) : pendingItem ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                {pendingItem.targeting === 'ally' ? `Choose an ally for ${pendingItem.name}.` : `Choose a foe for ${pendingItem.name}.`}
              </p>
              <button className="btn" onClick={() => { sfx.click(); setPendingItem(null); }}>← Cancel</button>
            </>
          ) : pendingMark ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>Choose a foe to mark.</p>
              <button className="btn" onClick={() => { sfx.click(); setPendingMark(false); }}>← Cancel</button>
            </>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                {target ? `Striking ${combat.combatants.find((c) => c.id === target)?.name}` : 'Choose a foe, then your attack — or use your power.'}
              </p>
              <div className="row">
                {heroChar.attacks.map((a) => (
                  <button key={a.name} className="btn btn-primary" disabled={!target || livingEnemies.length === 0} onClick={() => heroAttack(a.name)}>
                    {a.name} <span style={{ opacity: 0.7 }}>({a.damageDice}{a.damageBonus ? `+${a.damageBonus}` : ''})</span>
                  </button>
                ))}
                {power && (
                  <button className="btn btn-power" disabled={usesLeft <= 0} title={power.description} onClick={choosePower}>
                    ✦ {power.name} <span style={{ opacity: 0.7 }}>({usesLeft} left)</span>
                  </button>
                )}
                {stashCount > 0 && (
                  <button className="btn" onClick={() => { sfx.click(); setItemMenuOpen((o) => !o); }}>
                    🧪 Use Item ({stashCount})
                  </button>
                )}
                {state.luck > 0 && !actor.nextAttack && (
                  <button className="btn" title="Spend a Luck token for advantage on this attack" onClick={spendLuckAdvantage}>
                    ✦ Luck: advantage ({state.luck})
                  </button>
                )}
                {!actor.backLine ? (
                  <button className="btn" disabled={(tacticUses[actor.id] ?? 0) <= 0} title="Roar a challenge — foes target you until your next turn" onClick={doTaunt}>
                    🛡 Taunt ({tacticUses[actor.id] ?? 0})
                  </button>
                ) : (
                  <button className="btn" disabled={(tacticUses[actor.id] ?? 0) <= 0 || livingEnemies.length === 0} title="Mark a foe — the party deals +2 damage to it" onClick={() => { sfx.click(); setItemMenuOpen(false); setPendingMark(true); }}>
                    🎯 Mark ({tacticUses[actor.id] ?? 0})
                  </button>
                )}
              </div>
              {itemMenuOpen && (
                <div className="row" style={{ marginTop: 8 }}>
                  {stash.map(([id, n]) => {
                    const it = getItem(id);
                    return (
                      <button key={id} className="btn" title={it.description} onClick={() => chooseItem(it)}>
                        {it.name} ×{n}
                      </button>
                    );
                  })}
                </div>
              )}
              {power && <p className="faint" style={{ fontSize: '0.82rem', marginTop: 8 }}>{power.description}</p>}
            </>
          )
        ) : (
          <button className="btn btn-danger" onClick={enemyContinue}>Continue — {actor.name} acts ▸</button>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16, maxHeight: 140, overflowY: 'auto', padding: '12px 16px' }}>
        {combat.log.map((entry, i) => (
          <p key={i} className="muted" style={{ margin: '2px 0', fontSize: '0.86rem' }}>{entry}</p>
        ))}
      </div>
    </div>
  );
}
