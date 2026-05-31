import { useMemo, useState } from 'react';
import { useGame } from '../state/GameContext';
import { getScene } from '../engine/story';
import { getAdventure, getCharacter, toHero, makeHeroAttackLookup } from '../engine/party';
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant } from '../engine/combat';
import { defaultRng } from '../engine/rng';
import { hpColor } from '../ui/visuals';
import { sfx } from '../ui/sfx';
import type { CombatState } from '../types';

interface Flash { id: string; amount: number; nonce: number; }

// Find which combatant lost the most HP between two states (for the hit animation).
function diffDamage(prev: CombatState, next: CombatState): Flash | null {
  let best: Flash | null = null;
  for (const a of prev.combatants) {
    const b = next.combatants.find((c) => c.id === a.id);
    if (!b) continue;
    const lost = a.hp - b.hp;
    if (lost > 0 && (!best || lost > best.amount)) best = { id: a.id, amount: lost, nonce: 0 };
  }
  return best;
}

export function CombatView() {
  const { state, dispatch } = useGame();
  const adventure = getAdventure();
  const scene = getScene(adventure, state.sceneId);

  const lookup = useMemo(() => makeHeroAttackLookup(state.partyIds), [state.partyIds]);

  const [combat, setCombat] = useState<CombatState>(() => {
    if (scene.type !== 'combat') throw new Error('CombatView requires a combat scene');
    const heroes = state.partyIds.map((id) => toHero(id, state.hp[id] ?? getCharacter(id).maxHp));
    return startCombat(heroes, scene.enemies, defaultRng);
  });

  const [target, setTarget] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  if (scene.type !== 'combat') return null;

  const actor = currentCombatant(combat);
  const livingEnemies = combat.combatants.filter((c) => !c.isHero && c.hp > 0);

  function applyResult(prev: CombatState, next: CombatState) {
    const dmg = diffDamage(prev, next);
    if (dmg) {
      sfx.hit();
      setFlash({ ...dmg, nonce: Date.now() });
      setTimeout(() => setFlash(null), 850);
    }
    setCombat(next);

    const hp: Record<string, number> = {};
    next.combatants.filter((c) => c.isHero).forEach((c) => { hp[c.heroId!] = c.hp; });
    dispatch({ type: 'SET_HP', hp });

    if (next.status !== 'active' && scene.type === 'combat') {
      next.log.forEach((entry) => dispatch({ type: 'LOG', entry }));
      const dest = next.status === 'victory' ? scene.onVictory : scene.onDefeat;
      setTimeout(() => dispatch({ type: 'GOTO_SCENE', sceneId: dest }), dmg ? 700 : 0);
    }
  }

  function heroAttack(attackName: string) {
    if (!target) return;
    sfx.click();
    const next = performHeroAttack(combat, actor.id, attackName, target, defaultRng, lookup);
    setTarget(null);
    applyResult(combat, next);
  }

  function enemyContinue() {
    const next = performEnemyTurn(combat, defaultRng);
    applyResult(combat, next);
  }

  const heroChar = actor.isHero ? getCharacter(actor.heroId!) : null;

  return (
    <div className="app-shell screen">
      <h2 className="scene-title" style={{ color: 'var(--blood-bright)', fontSize: '1.7rem' }}>⚔ {scene.title}</h2>
      <div className="scene-rule" style={{ background: 'linear-gradient(90deg, transparent, var(--blood), transparent)' }} />
      <p style={{ lineHeight: 1.7, fontSize: '1.1rem' }}>{scene.narration}</p>

      <div className="game-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <div>
          <h3 className="engraved" style={{ fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Foes</h3>
          <div className="stack">
            {combat.combatants.filter((c) => !c.isHero).map((e) => {
              const isFlash = flash?.id === e.id;
              return (
                <button
                  key={e.id}
                  className={`panel combatant${isFlash ? ' hit' : ''}${target === e.id ? ' active-turn' : ''}`}
                  disabled={e.hp <= 0 || !actor.isHero}
                  onClick={() => { sfx.click(); setTarget(e.id); }}
                  style={{ position: 'relative', textAlign: 'left', cursor: e.hp > 0 && actor.isHero ? 'pointer' : 'default', opacity: e.hp <= 0 ? 0.4 : 1, padding: 14 }}
                >
                  {isFlash && <span key={flash!.nonce} className="dmg-float">-{flash!.amount}</span>}
                  <strong className="engraved" style={{ fontWeight: 600 }}>{e.name}</strong>
                  {e.hp <= 0 && <span className="faint"> — slain</span>}
                  <div className="hp-bar" style={{ marginTop: 8 }}>
                    <div className="hp-fill" style={{ width: `${(e.hp / e.maxHp) * 100}%`, background: hpColor(e.hp / e.maxHp) }} />
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 5, fontSize: '0.82rem' }}>
                    <span className="muted">{e.hp}/{e.maxHp} HP</span>
                    <span className="stat-pill" style={{ color: 'var(--arcane)' }}>AC {e.ac}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="engraved" style={{ fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>The Party</h3>
          <div className="stack">
            {combat.combatants.filter((c) => c.isHero).map((h) => {
              const isFlash = flash?.id === h.id;
              return (
                <div
                  key={h.id}
                  className={`panel combatant${isFlash ? ' hit' : ''}${actor.id === h.id ? ' active-turn' : ''}`}
                  style={{ position: 'relative', opacity: h.hp <= 0 ? 0.45 : 1, padding: 14 }}
                >
                  {isFlash && <span key={flash!.nonce} className="dmg-float">-{flash!.amount}</span>}
                  <strong className="engraved" style={{ fontWeight: 600 }}>{getCharacter(h.heroId!).portrait} {h.name}</strong>
                  {h.hp <= 0 && <span style={{ color: 'var(--blood-bright)' }}> — down</span>}
                  <div className="hp-bar" style={{ marginTop: 8 }}>
                    <div className="hp-fill" style={{ width: `${(h.hp / h.maxHp) * 100}%`, background: hpColor(h.hp / h.maxHp) }} />
                  </div>
                  <div className="muted" style={{ fontSize: '0.82rem', marginTop: 5 }}>{h.hp}/{h.maxHp} HP</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel panel--framed" style={{ marginTop: 20 }}>
        <p style={{ marginTop: 0 }}>
          <span className="stat-pill" style={{ marginRight: 8 }}>Round {combat.round}</span>
          <strong className="engraved">{actor.name}</strong>’s turn
        </p>
        {actor.isHero && heroChar ? (
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
            </div>
          </>
        ) : (
          <button className="btn btn-danger" onClick={enemyContinue}>Continue — {actor.name} acts ▸</button>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16, maxHeight: 150, overflowY: 'auto', padding: '12px 16px' }}>
        {combat.log.map((entry, i) => (
          <p key={i} className="muted" style={{ margin: '2px 0', fontSize: '0.86rem', fontStyle: 'italic' }}>{entry}</p>
        ))}
      </div>
    </div>
  );
}
