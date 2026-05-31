import { describe, it, expect } from 'vitest';
import { makeRng } from './rng';
import { rollDie, rollD20, rollDice, rollD20WithMode } from './dice';

describe('dice', () => {
  it('rollDie returns 1..sides', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = rollDie(6, r);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('rollDie hits both extremes', () => {
    const r = makeRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rollDie(6, r));
    expect(seen.has(1)).toBe(true);
    expect(seen.has(6)).toBe(true);
  });

  it('rollD20 returns 1..20', () => {
    const r = makeRng(3);
    for (let i = 0; i < 500; i++) {
      const v = rollD20(r);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it('rollDice parses "2d6+3" and sums dice plus flat bonus', () => {
    const max: () => number = () => 0.999999;
    const result = rollDice('2d6+3', max);
    expect(result.total).toBe(2 * 6 + 3);
    expect(result.rolls).toEqual([6, 6]);
    expect(result.bonus).toBe(3);
  });

  it('rollDice handles "1d8" with no bonus', () => {
    const min: () => number = () => 0;
    const result = rollDice('1d8', min);
    expect(result.rolls).toEqual([1]);
    expect(result.bonus).toBe(0);
    expect(result.total).toBe(1);
  });

  it('rollDice supports a damageBonus argument added on top', () => {
    const max: () => number = () => 0.999999;
    const result = rollDice('1d8', max, 3);
    expect(result.total).toBe(8 + 3);
    expect(result.bonus).toBe(3);
  });

  it('rollD20WithMode: no mode returns one die', () => {
    const r = makeRng(5);
    const res = rollD20WithMode(r);
    expect(res.rolls).toHaveLength(1);
    expect(res.value).toBe(res.rolls[0]);
  });

  it('rollD20WithMode: advantage takes the higher of two', () => {
    const probe = makeRng(99);
    const a = rollDie(20, probe);
    const b = rollDie(20, probe);
    const res = rollD20WithMode(makeRng(99), 'adv');
    expect(res.rolls).toEqual([a, b]);
    expect(res.value).toBe(Math.max(a, b));
  });

  it('rollD20WithMode: disadvantage takes the lower of two', () => {
    const probe = makeRng(99);
    const a = rollDie(20, probe);
    const b = rollDie(20, probe);
    const res = rollD20WithMode(makeRng(99), 'dis');
    expect(res.value).toBe(Math.min(a, b));
  });
});
