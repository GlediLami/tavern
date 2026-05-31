import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, clearSave, SAVE_KEY } from './save';

describe('save', () => {
  beforeEach(() => localStorage.clear());

  it('loadGame returns null when nothing saved', () => {
    expect(loadGame()).toBeNull();
  });

  it('round-trips a saved object', () => {
    const data = { phase: 'adventure', sceneId: 'tower_base', partyIds: ['a', 'b'] };
    saveGame(data);
    expect(loadGame()).toEqual(data);
  });

  it('clearSave removes the save', () => {
    saveGame({ phase: 'adventure' });
    clearSave();
    expect(loadGame()).toBeNull();
  });

  it('loadGame returns null on corrupt data', () => {
    localStorage.setItem(SAVE_KEY, '{not json');
    expect(loadGame()).toBeNull();
  });
});
