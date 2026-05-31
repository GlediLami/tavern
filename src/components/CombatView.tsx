import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/GameContext';
import { getScene } from '../engine/story';
import { getAdventure, getCharacter, toHero, makeHeroAttackLookup } from '../engine/party';
import { startCombat, performHeroAttack, performHeroHeal, performEnemyTurn, currentCombatant } from '../engine/combat';
import { scaleEnemies, restHp, config, effectiveMaxHp } from '../engine/difficulty';
import { defaultRng } from '../engine/rng';
import { hpColor } from '../ui/visuals';
import { sfx } from '../ui/sfx';
import type { CombatState } from '../types';
import { CombatDice } from './CombatDice';

interface Flash { id: string; amount: number; heal: boolean; nonce: number; }

const HEAL_USES = 2;
const HEAL_DICE = '1d8';
const HEAL_BONUS = 2;

export function CombatView() {
  const { state, dispatch } = useGame();
  const adventure = getAdventure(state.adventureId);
  const scene = getScene(adventure, state.sceneId);

  const lookup = useMemo(() => makeHeroAttackLookup(state.partyIds), [state.partyIds]);

  // Build the encounter once, scaling enemies and seeding heroes from saved HP.
  const [combat, setCombat] = useState<CombatState>(() => {
    if (scene.type !== 'combat') throw new Error('CombatView requires a combat scene');
    const heroes = state.partyIds.map((id) => {
      const c = getCharacter(id);
      return toHero(id, state.hp[id] ?? effectiveMaxHp(c, state.difficulty));
    });
    // give floored heroes the right maxHp too
    heroes.forEach((h) => { h.maxHp = effectiveMaxHp(getCharacter(h.id), state.difficulty); });
    const enemies = scaleEnemies(scene.enemies, state.difficulty, state.partyIds.length);
    return startCombat(heroes, enemies, defaultRng);
  });

  const [target, setTarget] = useState<string | null>(null);
  const [healMode, setHealMode] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const [healUses, setHealUses] = useState<Record<string, number>>(() => {
    const u: Record<string, number> = {};
    state.partyIds.forEach((id) => {
      if (config(state.difficulty).clericHeal && getCharacter(id).class === 'Cleric') u[id] = HEAL_USES;
    });
    return u;
  });

  if (scene.type !== 'combat') return null;

  const actor = currentCombatant(combat);
  const livingEnemies = combat.combatants.filter((c) => !c.isHero && c.hp > 0);
  const livingAllies = combat.combatants.filter((c) => c.isHero && c.hp > 0);
  const heroChar = actor.isHero ? getCharacter(actor.heroId!) : null;
  const canHeal = !!heroChar && (healUses[actor.id] ?? 0) > 0;

  function applyResult(next: CombatState) {
    const ev = next.lastAttack;
    if (ev && ev.amount > 0) {
      if (ev.kind === 'heal') sfx.click(); else sfx.hit();
      setFlash({ id: ev.targetId, amount: ev.amount, heal: ev.kind === 'heal', nonce: Date.now() });
      setTimeout(() => { if (mounted.current) setFlash(null); }, 850);
    }
    setCombat(next);

    const hp: Record<string, number> = {};
    next.combatants.filter((c) => c.isHero).forEach((c) => { hp[c.heroId!] = c.hp; });
    dispatch({ type: 'SET_HP', hp });

    if (next.status !== 'active' && scene.type === 'combat') {
      next.log.forEach((entry) => dispatch({ type: 'LOG', entry }));
      if (next.status === 'victory') {
        // short rest: survivors heal, the downed may revive (per difficulty).
        const healed: Record<string, number> = {};
        next.combatants.filter((c) => c.isHero).forEach((c) => {
          healed[c.heroId!] = restHp(c.hp, c.maxHp, state.difficulty);
        });
        dispatch({ type: 'SET_HP', hp: healed });
        const gained = Object.keys(healed).some((id) => healed[id] > (hp[id] ?? 0));
        if (gained) dispatch({ type: 'LOG', entry: 'The party catches their breath and binds their wounds.' });
        setTimeout(() => dispatch({ type: 'GOTO_SCENE', sceneId: scene.onVictory }), 700);
      } else {
        setTimeout(() => dispatch({ type: 'GOTO_SCENE', sceneId: scene.onDefeat }), 700);
      }
    }
  }

  function heroAttack(attackName: string) {
    if (!target) return;
    sfx.click();
    applyResult(performHeroAttack(combat, actor.id, attackName, target, defaultRng, lookup));
    setTarget(null);
  }

  function healAlly(allyId: string) {
    sfx.click();
    setHealUses((u) => ({ ...u, [actor.id]: (u[actor.id] ?? 0) - 1 }));
    setHealMode(false);
    applyResult(performHeroHeal(combat, actor.id, allyId, HEAL_DICE, HEAL_BONUS, 'Cure Wounds', defaultRng));
  }

  function enemyContinue() {
    applyResult(performEnemyTurn(combat, defaultRng));
  }

  return (
    <div className="app-shell screen">
      <h2 className="display danger-title" style={{ fontSize: '1.7rem' }}>⚔ {scene.title}</h2>
      <div className="rule-accent danger" />
      <p style={{ lineHeight: 1.7, fontSize: '1.08rem' }}>{scene.narration}</p>

      <div className="game-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Foes</h3>
          <div className="stack">
            {combat.combatants.filter((c) => !c.isHero).map((e) => {
              const isFlash = flash?.id === e.id;
              const selectable = e.hp > 0 && actor.isHero && !healMode;
              return (
                <button
                  key={e.id}
                  className={`panel combatant${isFlash ? (flash!.heal ? ' heal' : ' hit') : ''}${target === e.id ? ' active-turn' : ''}`}
                  disabled={!selectable}
                  onClick={() => { sfx.click(); setTarget(e.id); }}
                  style={{ position: 'relative', textAlign: 'left', cursor: selectable ? 'pointer' : 'default', opacity: e.hp <= 0 ? 0.4 : 1, padding: 14 }}
                >
                  {isFlash && <span key={flash!.nonce} className={`dmg-float${flash!.heal ? ' heal' : ''}`}>{flash!.heal ? '+' : '-'}{flash!.amount}</span>}
                  <strong style={{ fontWeight: 600 }}>{e.name}</strong>
                  {e.hp <= 0 && <span className="faint"> — slain</span>}
                  <div className="hp-bar" style={{ marginTop: 8 }} role="progressbar" aria-label={`${e.name} hit points`} aria-valuenow={e.hp} aria-valuemin={0} aria-valuemax={e.maxHp}>
                    <div className="hp-fill" style={{ width: `${(e.hp / Math.max(1, e.maxHp)) * 100}%`, background: hpColor(e.hp / Math.max(1, e.maxHp)) }} />
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 5, fontSize: '0.82rem' }}>
                    <span className="muted">{e.hp}/{e.maxHp} HP</span>
                    <span className="tag">AC {e.ac}</span>
                  </div>
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
              const healable = healMode && h.hp > 0;
              return (
                <button
                  key={h.id}
                  className={`panel combatant${isFlash ? (flash!.heal ? ' heal' : ' hit') : ''}${actor.id === h.id ? ' active-turn' : ''}`}
                  disabled={!healable}
                  onClick={() => healable && healAlly(h.id)}
                  style={{ position: 'relative', textAlign: 'left', width: '100%', opacity: h.hp <= 0 ? 0.45 : 1, padding: 14, cursor: healable ? 'pointer' : 'default' }}
                >
                  {isFlash && <span key={flash!.nonce} className={`dmg-float${flash!.heal ? ' heal' : ''}`}>{flash!.heal ? '+' : '-'}{flash!.amount}</span>}
                  <strong style={{ fontWeight: 600 }}>{getCharacter(h.heroId!).portrait} {h.name}</strong>
                  {h.hp <= 0 && <span style={{ color: 'var(--accent-bright)' }}> — down</span>}
                  <div className="hp-bar" style={{ marginTop: 8 }} role="progressbar" aria-label={`${h.name} hit points`} aria-valuenow={h.hp} aria-valuemin={0} aria-valuemax={h.maxHp}>
                    <div className="hp-fill" style={{ width: `${(h.hp / Math.max(1, h.maxHp)) * 100}%`, background: hpColor(h.hp / Math.max(1, h.maxHp)) }} />
                  </div>
                  <div className="muted" style={{ fontSize: '0.82rem', marginTop: 5 }}>{h.hp}/{h.maxHp} HP</div>
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
        </p>
        {actor.isHero && heroChar ? (
          healMode ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>Choose an ally to heal ({HEAL_DICE}+{HEAL_BONUS}).</p>
              <button className="btn" onClick={() => { sfx.click(); setHealMode(false); }}>← Cancel</button>
            </>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                {target ? `Striking ${combat.combatants.find((c) => c.id === target)?.name}` : 'Choose a foe, then your attack.'}
              </p>
              <div className="row">
                {heroChar.attacks.map((a) => (
                  <button key={a.name} className="btn btn-primary" disabled={!target || livingEnemies.length === 0} onClick={() => heroAttack(a.name)}>
                    {a.name} <span style={{ opacity: 0.7 }}>({a.damageDice}{a.damageBonus ? `+${a.damageBonus}` : ''})</span>
                  </button>
                ))}
                {canHeal && (
                  <button className="btn btn-heal" disabled={livingAllies.length === 0} onClick={() => { sfx.click(); setHealMode(true); }}>
                    ✚ Cure Wounds <span style={{ opacity: 0.7 }}>({healUses[actor.id]} left)</span>
                  </button>
                )}
              </div>
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
