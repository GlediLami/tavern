import type { AttackEvent } from '../types';

// Shows the real dice behind the most recent combat action: the d20 attack
// roll vs AC, and the individual damage (or healing) dice that were rolled.
export function CombatDice({ event }: { event: AttackEvent }) {
  const isHeal = event.kind === 'heal';
  const sumFaces = event.damageRolls.reduce((a, b) => a + b, 0);

  return (
    <div className="combat-dice" key={`${event.attackerName}-${event.targetName}-${event.amount}-${event.d20 ?? 'h'}`}>
      <div className="cd-line">
        <span className="muted">{event.attackerName}</span>
        <span className="cd-action">{event.actionName}</span>
        <span className="muted">→ {event.targetName}</span>
      </div>

      {!isHeal && event.d20 !== undefined && (
        <div className="cd-roll">
          <span className={`cd-d20${event.crit ? ' crit' : ''}${event.d20 === 1 ? ' fumble' : ''}`}>{event.d20}</span>
          <span className="cd-math">
            {event.mode && event.d20Rolls
              ? <span className="cd-adv">{event.mode === 'adv' ? 'advantage' : 'disadvantage'} ({event.d20Rolls.join(', ')}) → </span>
              : null}
            d20 {event.d20} {fmt(event.toHit ?? 0)} = <strong>{event.d20 + (event.toHit ?? 0)}</strong> vs AC {event.ac}
          </span>
          <span className={`cd-result ${event.hit ? 'hit' : 'miss'}`}>
            {event.crit ? 'CRIT!' : event.hit ? 'HIT' : 'MISS'}
          </span>
        </div>
      )}

      {(event.hit && event.damageRolls.length > 0) && (
        <div className="cd-roll">
          <span className="cd-dmg-label">{isHeal ? 'Heal' : 'Damage'} {event.damageDice}{event.damageBonus ? `+${event.damageBonus}` : ''}</span>
          <span className="cd-faces">
            {event.damageRolls.map((f, i) => <span key={i} className="cd-face">{f}</span>)}
            {event.damageBonus > 0 && <span className="cd-bonus">+{event.damageBonus}</span>}
          </span>
          <span className={isHeal ? 'cd-total heal' : 'cd-total dmg'}>
            = {sumFaces + event.damageBonus} {isHeal ? 'HP' : 'dmg'}
          </span>
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
