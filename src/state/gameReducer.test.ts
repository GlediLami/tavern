import { describe, it, expect } from 'vitest';
import { initialState, gameReducer, type GameState } from './gameReducer';

describe('gameReducer', () => {
  it('starts at the home phase with no party', () => {
    expect(initialState.phase).toBe('home');
    expect(initialState.partyIds).toEqual([]);
  });

  it('START_GAME moves to adventure-select', () => {
    const s = gameReducer(initialState, { type: 'START_GAME' });
    expect(s.phase).toBe('adventure-select');
  });

  it('SELECT_ADVENTURE stores the adventure + difficulty and moves to party-select', () => {
    let s = gameReducer(initialState, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'SELECT_ADVENTURE', adventureId: 'snakewater', difficulty: 'hard' });
    expect(s.phase).toBe('party-select');
    expect(s.adventureId).toBe('snakewater');
    expect(s.difficulty).toBe('hard');
  });

  it('CONFIRM_PARTY stores party, sets hp (HP floor on normal), and enters the start scene', () => {
    let s = gameReducer(initialState, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'SELECT_ADVENTURE', adventureId: 'brackenmoor', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm', 'alaric-vance'] });
    expect(s.phase).toBe('scene');
    expect(s.partyIds).toEqual(['bjorn-ironhelm', 'alaric-vance']);
    expect(s.sceneId).toBe('tavern_start');
    expect(s.hp['bjorn-ironhelm']).toBe(13);
    expect(s.hp['alaric-vance']).toBe(10); // wizard floored 7 -> 10 on normal
  });

  it('CONFIRM_PARTY on hard does not apply the HP floor', () => {
    let s = gameReducer(initialState, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'SELECT_ADVENTURE', adventureId: 'brackenmoor', difficulty: 'hard' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['alaric-vance'] });
    expect(s.hp['alaric-vance']).toBe(7);
  });

  it('GOTO_SCENE switches scene, and an ending scene sets the ending phase', () => {
    let s: GameState = { ...initialState, phase: 'scene', partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 }, sceneId: 'tavern_start', log: [] };
    s = gameReducer(s, { type: 'GOTO_SCENE', sceneId: 'tower_base' });
    expect(s.sceneId).toBe('tower_base');
    expect(s.phase).toBe('scene');

    s = gameReducer(s, { type: 'GOTO_SCENE', sceneId: 'ending_victory' });
    expect(s.phase).toBe('ending');
  });

  it('GOTO_SCENE into a combat scene sets the combat phase', () => {
    let s: GameState = { ...initialState, phase: 'scene', partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 }, sceneId: 'tower_base', log: [] };
    s = gameReducer(s, { type: 'GOTO_SCENE', sceneId: 'marsh_spider' });
    expect(s.phase).toBe('combat');
  });

  it('SET_HP updates a hero\'s current hp', () => {
    let s: GameState = { ...initialState, partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 } };
    s = gameReducer(s, { type: 'SET_HP', hp: { 'bjorn-ironhelm': 4 } });
    expect(s.hp['bjorn-ironhelm']).toBe(4);
  });

  it('RESET returns to the initial state', () => {
    let s = gameReducer(initialState, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'RESET' });
    expect(s).toEqual(initialState);
  });

  it('LOG appends a narration entry', () => {
    const s = gameReducer(initialState, { type: 'LOG', entry: 'You rolled a 17.' });
    expect(s.log[s.log.length - 1]).toBe('You rolled a 17.');
  });
});
