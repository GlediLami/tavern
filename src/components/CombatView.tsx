import { useMemo, useState } from 'react';
import { useGame } from '../state/GameContext';
import { getScene } from '../engine/story';
import { getAdventure, getCharacter, toHero, makeHeroAttackLookup } from '../engine/party';
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant } from '../engine/combat';
import { defaultRng } from '../engine/rng';
import type { CombatState } from '../types';

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

  if (scene.type !== 'combat') return null;

  const actor = currentCombatant(combat);
  const livingEnemies = combat.combatants.filter((c) => !c.isHero && c.hp > 0);

  function syncHpAndRoute(next: CombatState) {
    const hp: Record<string, number> = {};
    next.combatants.filter((c) => c.isHero).forEach((c) => { hp[c.heroId!] = c.hp; });
    dispatch({ type: 'SET_HP', hp });

    if (next.status !== 'active' && scene.type === 'combat') {
      next.log.forEach((entry) => dispatch({ type: 'LOG', entry }));
      const dest = next.status === 'victory' ? scene.onVictory : scene.onDefeat;
      dispatch({ type: 'GOTO_SCENE', sceneId: dest });
    }
  }

  function heroAttack(attackName: string) {
    if (!target) return;
    const next = performHeroAttack(combat, actor.id, attackName, target, defaultRng, lookup);
    setCombat(next);
    setTarget(null);
    syncHpAndRoute(next);
  }

  function enemyContinue() {
    const next = performEnemyTurn(combat, defaultRng);
    setCombat(next);
    syncHpAndRoute(next);
  }

  const heroChar = actor.isHero ? getCharacter(actor.heroId!) : null;

  return (
    <div className="app-shell">
      <h2 style={{ color: 'var(--blood)' }}>⚔️ {scene.title}</h2>
      <p style={{ lineHeight: 1.6 }}>{scene.narration}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <h3>Enemies</h3>
          <div className="stack">
            {combat.combatants.filter((c) => !c.isHero).map((e) => (
              <button
                key={e.id}
                className="panel"
                disabled={e.hp <= 0 || !actor.isHero}
                onClick={() => setTarget(e.id)}
                style={{
                  textAlign: 'left', cursor: e.hp > 0 ? 'pointer' : 'default',
                  opacity: e.hp <= 0 ? 0.4 : 1,
                  borderColor: target === e.id ? 'var(--gold)' : 'var(--border)',
                }}
              >
                <strong>{e.name}</strong> — HP {e.hp}/{e.maxHp} · AC {e.ac}
                {e.hp <= 0 && ' (defeated)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3>Party</h3>
          <div className="stack">
            {combat.combatants.filter((c) => c.isHero).map((h) => (
              <div key={h.id} className="panel" style={{ opacity: h.hp <= 0 ? 0.45 : 1, borderColor: actor.id === h.id ? 'var(--gold)' : 'var(--border)' }}>
                <strong>{h.name}</strong> — HP {h.hp}/{h.maxHp}
                {h.hp <= 0 && <span style={{ color: 'var(--blood)' }}> (down)</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <p><strong>Round {combat.round}</strong> — {actor.name}'s turn</p>
        {actor.isHero && heroChar ? (
          <>
            <p className="muted">{target ? `Target: ${combat.combatants.find((c) => c.id === target)?.name}` : 'Select an enemy, then choose an attack.'}</p>
            <div className="row">
              {heroChar.attacks.map((a) => (
                <button key={a.name} className="btn btn-primary" disabled={!target || livingEnemies.length === 0} onClick={() => heroAttack(a.name)}>
                  {a.name} ({a.damageDice}{a.damageBonus ? `+${a.damageBonus}` : ''})
                </button>
              ))}
            </div>
          </>
        ) : (
          <button className="btn" onClick={enemyContinue}>Continue ({actor.name} acts)</button>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16, maxHeight: 160, overflowY: 'auto' }}>
        {combat.log.map((entry, i) => (
          <p key={i} className="muted" style={{ margin: '2px 0', fontSize: '0.85rem' }}>{entry}</p>
        ))}
      </div>
    </div>
  );
}
