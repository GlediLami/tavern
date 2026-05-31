import { describe, it, expect } from 'vitest';
import { effectiveMaxHp, restHp, scaleEnemies, config, campRestHp, levelPowerBonus } from './difficulty';
import type { Character, Enemy } from '../types';

const wizard: Character = {
  id: 'w', name: 'W', race: 'Elf', class: 'Wizard', level: 1, portrait: '🔮',
  abilities: { str: 8, dex: 15, con: 13, int: 17, wis: 12, cha: 10 },
  maxHp: 7, ac: 12, proficiencyBonus: 2, skillProficiencies: [], attacks: [], backstory: '',
};

const enemies: Enemy[] = [
  { name: 'Big', maxHp: 14, ac: 14, attack: { name: 'Bite', toHit: 5, damageDice: '1d8', damageBonus: 3 } },
  { name: 'Small', maxHp: 8, ac: 13, attack: { name: 'Bite', toHit: 4, damageDice: '1d6', damageBonus: 2 } },
];

describe('difficulty', () => {
  it('normal applies a HP floor; hard does not', () => {
    expect(effectiveMaxHp(wizard, 'normal')).toBe(10); // floored up from 7
    expect(effectiveMaxHp(wizard, 'hard')).toBe(7);
  });

  it('rest heals survivors and revives the downed on normal', () => {
    // survivor at 4/10 heals ceil(10*0.6)=6 -> 10 (capped)
    expect(restHp(4, 10, 'normal')).toBe(10);
    // downed revives to ceil(10*0.25)=3
    expect(restHp(0, 10, 'normal')).toBe(3);
  });

  it('hard heals little and never revives the downed', () => {
    expect(restHp(8, 12, 'hard')).toBe(8 + Math.ceil(12 * 0.25)); // 8+3=11
    expect(restHp(0, 12, 'hard')).toBe(0);
  });

  it('normal softens enemy damage and to-hit', () => {
    const scaled = scaleEnemies([enemies[0]], 'normal', 4);
    expect(scaled[0].attack.toHit).toBe(4);           // 5 - 1
    expect(scaled[0].attack.damageBonus).toBe(Math.round(3 * 0.85)); // 3 -> 3
  });

  it('hard leaves enemy stats intact', () => {
    const scaled = scaleEnemies(enemies, 'hard', 1);
    expect(scaled).toHaveLength(2);
    expect(scaled[0].attack.toHit).toBe(5);
  });

  it('solo scaling drops the weakest extra for parties <= 2 on normal', () => {
    const scaled = scaleEnemies(enemies, 'normal', 2);
    expect(scaled).toHaveLength(1);
    expect(scaled[0].name).toBe('Big'); // weakest "Small" dropped
  });

  it('does not drop enemies for full parties', () => {
    expect(scaleEnemies(enemies, 'normal', 3)).toHaveLength(2);
  });

  it('camp rest fully restores on normal and revives the downed', () => {
    expect(campRestHp(3, 12, 'normal')).toBe(12);   // full heal
    expect(campRestHp(0, 12, 'normal')).toBe(6);     // downed -> half
  });

  it('camp rest is partial on hard', () => {
    expect(campRestHp(4, 12, 'hard')).toBe(4 + Math.ceil(12 * 0.5)); // 4+6=10
    expect(campRestHp(0, 12, 'hard')).toBe(3);                        // downed -> quarter
  });

  it('effectiveMaxHp adds +4 max HP per level above 1', () => {
    expect(effectiveMaxHp(wizard, 'normal', 1)).toBe(10);
    expect(effectiveMaxHp(wizard, 'normal', 3)).toBe(18); // 10 + 2*4
    expect(effectiveMaxHp(wizard, 'hard', 3)).toBe(7 + 8); // no floor on hard
  });

  it('levelPowerBonus is level-1, never negative', () => {
    expect(levelPowerBonus(1)).toBe(0);
    expect(levelPowerBonus(4)).toBe(3);
    expect(levelPowerBonus(0)).toBe(0);
  });

  it('exposes labels for the UI', () => {
    expect(config('normal').label).toBe('Normal');
    expect(config('hard').label).toBe('Hard');
  });
});
