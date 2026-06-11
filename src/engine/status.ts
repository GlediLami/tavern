import type { Combatant, CombatState, Status } from '../types';

export const STATUSES: Record<string, Status> = {
  burning: { id: 'burning', name: 'Burning', kind: 'dot', icon: '🔥', amount: 3, duration: 2, description: 'Takes 3 fire damage at the end of its turn.' },
  vulnerable: { id: 'vulnerable', name: 'Vulnerable', kind: 'vulnerable', icon: '💥', amount: 2, duration: 2, description: 'Takes +2 damage from attacks.' },
  weakened: { id: 'weakened', name: 'Weakened', kind: 'weakened', icon: '🔻', amount: 2, duration: 2, description: 'Deals 2 less attack damage.' },
};

export function applyStatus(c: Combatant, id: string): void {
  const s = STATUSES[id];
  if (!s) return;
  if (!c.statuses) c.statuses = {};
  c.statuses[id] = Math.max(c.statuses[id] ?? 0, s.duration);
}

// End-of-turn: deal DoT damage, decrement every status, drop expired. Returns damage dealt.
export function tickStatuses(state: CombatState, combatantId: string): number {
  const c = state.combatants.find((x) => x.id === combatantId);
  if (!c || !c.statuses) return 0;
  let damage = 0;
  for (const [id, turns] of Object.entries(c.statuses)) {
    const s = STATUSES[id];
    if (s?.kind === 'dot' && turns > 0 && c.hp > 0) {
      damage += s.amount;
    }
  }
  if (damage > 0) {
    c.hp = Math.max(0, c.hp - damage);
    state.log.push(`${c.name} suffers ${damage} damage from lingering effects.`);
    if (c.hp === 0) state.log.push(`${c.name} ${c.isHero ? 'is down' : 'falls'}!`);
  }
  const next: Record<string, number> = {};
  for (const [id, turns] of Object.entries(c.statuses)) {
    if (turns - 1 > 0) next[id] = turns - 1;
  }
  c.statuses = next;
  return damage;
}

function active(c: Combatant, id: string): boolean {
  return (c.statuses?.[id] ?? 0) > 0;
}

export function incomingBonus(c: Combatant): number {
  return active(c, 'vulnerable') ? STATUSES.vulnerable.amount : 0;
}

export function outgoingPenalty(c: Combatant): number {
  return active(c, 'weakened') ? STATUSES.weakened.amount : 0;
}

export function hasAnyStatus(c: Combatant): boolean {
  return Object.values(c.statuses ?? {}).some((t) => t > 0);
}

export function activeStatuses(c: Combatant): { id: string; turns: number; icon: string }[] {
  return Object.entries(c.statuses ?? {})
    .filter(([, t]) => t > 0)
    .map(([id, turns]) => ({ id, turns, icon: STATUSES[id]?.icon ?? '?' }));
}
