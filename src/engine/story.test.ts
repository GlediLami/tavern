import { describe, it, expect } from 'vitest';
import { getScene, resolveChoice } from './story';
import type { Adventure, Choice } from '../types';

const adv: Adventure = {
  title: 'T', startSceneId: 'a',
  scenes: {
    a: { id: 'a', type: 'story', title: 'A', narration: '', choices: [] },
    b: { id: 'b', type: 'story', title: 'B', narration: '', choices: [] },
    c: { id: 'c', type: 'story', title: 'C', narration: '', choices: [] },
  },
};

describe('story', () => {
  it('getScene returns the scene by id', () => {
    expect(getScene(adv, 'b').title).toBe('B');
  });

  it('getScene throws on unknown id', () => {
    expect(() => getScene(adv, 'zzz')).toThrow();
  });

  it('resolveChoice follows next for choices without a check', () => {
    const choice: Choice = { id: 'x', text: 'go', next: 'b' };
    expect(resolveChoice(choice, null)).toBe('b');
  });

  it('resolveChoice routes to onSuccess/onFailure based on check result', () => {
    const choice: Choice = { id: 'x', text: 'try', check: { skill: 'athletics', dc: 10 }, onSuccess: 'b', onFailure: 'c' };
    expect(resolveChoice(choice, true)).toBe('b');
    expect(resolveChoice(choice, false)).toBe('c');
  });
});
