import { describe, it, expect } from 'vitest';
import { STATUSES, applyStatus, tickStatuses, incomingBonus, outgoingPenalty, hasAnyStatus, activeStatuses } from './status';
import type { Combatant, CombatState } from '../types';

function combatant(over: Partial<Combatant> = {}): Combatant {
  return { id: 'c', name: 'C', isHero: false, maxHp: 20, hp: 20, ac: 12, initiative: 10, ...over };
}
function stateWith(c: Combatant): CombatState {
  return { combatants: [c], order: [c.id], turnIndex: 0, round: 1, log: [], status: 'active' };
}

describe('status', () => {
  it('applyStatus sets/refreshes the duration', () => {
    const c = combatant();
    applyStatus(c, 'burning');
    expect(c.statuses!.burning).toBe(STATUSES.burning.duration);
    c.statuses!.burning = 1;
    applyStatus(c, 'burning'); // refresh up to full
    expect(c.statuses!.burning).toBe(STATUSES.burning.duration);
  });

  it('tickStatuses applies DoT, decrements, and removes expired', () => {
    const c = combatant({ statuses: { burning: 2, vulnerable: 1 } });
    const st = stateWith(c);
    const dmg = tickStatuses(st, 'c');
    expect(dmg).toBe(STATUSES.burning.amount); // burning dealt
    expect(c.hp).toBe(20 - STATUSES.burning.amount);
    expect(c.statuses!.burning).toBe(1);        // 2 -> 1
    expect(c.statuses!.vulnerable).toBeUndefined(); // 1 -> 0 removed
  });

  it('incomingBonus / outgoingPenalty reflect vulnerable / weakened', () => {
    expect(incomingBonus(combatant({ statuses: { vulnerable: 2 } }))).toBe(STATUSES.vulnerable.amount);
    expect(incomingBonus(combatant())).toBe(0);
    expect(outgoingPenalty(combatant({ statuses: { weakened: 2 } }))).toBe(STATUSES.weakened.amount);
  });

  it('hasAnyStatus / activeStatuses', () => {
    expect(hasAnyStatus(combatant())).toBe(false);
    const c = combatant({ statuses: { burning: 2 } });
    expect(hasAnyStatus(c)).toBe(true);
    expect(activeStatuses(c)).toEqual([{ id: 'burning', turns: 2, icon: STATUSES.burning.icon }]);
  });
});
