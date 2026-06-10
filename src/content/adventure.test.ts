import { describe, it, expect } from 'vitest';
import { ADVENTURES } from './adventures';
import type { Scene } from '../types';

function targets(scene: Scene): string[] {
  if (scene.type === 'story') {
    return scene.choices.flatMap((c) =>
      c.check ? [c.onSuccess!, c.onFailure!] : [c.next!],
    );
  }
  if (scene.type === 'combat') return [scene.onVictory, scene.onDefeat];
  return [];
}

describe.each(ADVENTURES.map((a) => [a.id, a.data] as const))('adventure %s', (_id, adventure) => {
  const ids = new Set(Object.keys(adventure.scenes));

  it('has a valid start scene', () => {
    expect(ids.has(adventure.startSceneId)).toBe(true);
  });

  it('scene map keys match scene ids', () => {
    for (const [key, scene] of Object.entries(adventure.scenes)) {
      expect(scene.id).toBe(key);
    }
  });

  it('every transition target references an existing scene', () => {
    for (const scene of Object.values(adventure.scenes)) {
      for (const t of targets(scene)) {
        expect(t).toBeDefined();
        expect(ids.has(t), `missing scene "${t}" referenced by "${scene.id}"`).toBe(true);
      }
    }
  });

  it('every scene is reachable from the start', () => {
    const seen = new Set<string>();
    const stack = [adventure.startSceneId];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const t of targets(adventure.scenes[id])) stack.push(t);
    }
    for (const id of ids) {
      expect(seen.has(id), `unreachable scene "${id}"`).toBe(true);
    }
  });

  it('has at least 2 combat scenes and both victory and defeat endings', () => {
    const scenes = Object.values(adventure.scenes);
    expect(scenes.filter((s) => s.type === 'combat').length).toBeGreaterThanOrEqual(2);
    const endings = scenes.filter((s) => s.type === 'ending') as Extract<Scene, { type: 'ending' }>[];
    expect(endings.some((e) => e.endingType === 'victory')).toBe(true);
    expect(endings.some((e) => e.endingType === 'defeat')).toBe(true);
  });

  it('every enemy ability has a valid kind and at least one use', () => {
    for (const scene of Object.values(adventure.scenes)) {
      if (scene.type !== 'combat') continue;
      for (const e of scene.enemies) {
        if (!e.ability) continue;
        expect(['debuff', 'buff']).toContain(e.ability.kind);
        expect(e.ability.uses).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every requiresFlag / epilogue flag is set somewhere in the adventure', () => {
    const set = new Set<string>();
    for (const s of Object.values(adventure.scenes)) {
      (s.setFlags ?? []).forEach((f) => set.add(f));
      if (s.type === 'story') for (const c of s.choices) (c.setFlags ?? []).forEach((f) => set.add(f));
    }
    for (const s of Object.values(adventure.scenes)) {
      if (s.type === 'story') for (const c of s.choices) {
        if (c.requiresFlag) expect(set.has(c.requiresFlag), `flag "${c.requiresFlag}" never set in ${_id}`).toBe(true);
      }
      if (s.type === 'ending') for (const e of (s.epilogues ?? [])) {
        expect(set.has(e.flag), `epilogue flag "${e.flag}" never set in ${_id}`).toBe(true);
      }
    }
  });

  it('every check choice has both branches; every plain choice has next', () => {
    for (const scene of Object.values(adventure.scenes)) {
      if (scene.type !== 'story') continue;
      for (const c of scene.choices) {
        if (c.check) {
          expect(c.onSuccess).toBeTruthy();
          expect(c.onFailure).toBeTruthy();
        } else {
          expect(c.next).toBeTruthy();
        }
      }
    }
  });
});
