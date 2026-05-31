import { describe, it, expect, beforeEach } from 'vitest';
import { loadValidatedGame } from './persistence';
import { saveGame, loadGame } from '../engine/save';
import type { GameState } from './gameReducer';

const valid: GameState = {
  phase: 'scene', adventureId: 'brackenmoor', difficulty: 'normal',
  partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 },
  sceneId: 'tavern_start', log: [],
};

describe('loadValidatedGame', () => {
  beforeEach(() => localStorage.clear());

  it('returns a structurally sound save', () => {
    saveGame(valid);
    expect(loadValidatedGame()).toEqual(valid);
  });

  it('discards a save whose scene no longer exists, and prunes it', () => {
    saveGame({ ...valid, sceneId: 'a_scene_that_was_renamed_away' });
    expect(loadValidatedGame()).toBeNull();
    expect(loadGame()).toBeNull(); // pruned
  });

  it('discards a stale save missing adventureId/difficulty', () => {
    saveGame({ phase: 'scene', partyIds: ['bjorn-ironhelm'], hp: {}, sceneId: 'tavern_start', log: [] });
    expect(loadValidatedGame()).toBeNull();
  });

  it('discards a save referencing an unknown hero', () => {
    saveGame({ ...valid, partyIds: ['nonexistent-hero'] });
    expect(loadValidatedGame()).toBeNull();
  });

  it('returns null when there is no save', () => {
    expect(loadValidatedGame()).toBeNull();
  });
});
