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

  it('START_CAMPAIGN sets campaign mode, order, level 1, and the first adventure', () => {
    let s = gameReducer(initialState, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    expect(s.mode).toBe('campaign');
    expect(s.campaign).toEqual({ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 0, level: 1 });
    expect(s.adventureId).toBe('snakewater');
    expect(s.phase).toBe('party-select');
  });

  it('CONFIRM_PARTY in a campaign seeds HP at the party level', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = { ...s, campaign: { ...s.campaign!, level: 3 } };
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.hp['bjorn-ironhelm']).toBe(13 + 8);
  });

  it('ADVANCE_CAMPAIGN levels up, moves to the next adventure, and full-heals', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    s = gameReducer(s, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.campaign).toEqual({ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 1, level: 2 });
    expect(s.adventureId).toBe('chaoticcaves');
    expect(s.sceneId).toBe('town_briefing');
    expect(s.phase).toBe('scene');
    expect(s.hp['bjorn-ironhelm']).toBe(13 + 4);
  });

  it('SELECT_ADVENTURE keeps single mode and clears campaign', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'hard' });
    s = gameReducer(s, { type: 'SELECT_ADVENTURE', adventureId: 'brackenmoor', difficulty: 'normal' });
    expect(s.mode).toBe('single');
    expect(s.campaign).toBeUndefined();
  });

  it('RECORD merges deltas: numbers add, biggestHit maxes, damageByHero merges', () => {
    let s = gameReducer(initialState, { type: 'RECORD', delta: { crits: 1, biggestHit: 8, damageByHero: { a: 5 } } });
    s = gameReducer(s, { type: 'RECORD', delta: { crits: 2, biggestHit: 5, damageByHero: { a: 3, b: 7 } } });
    expect(s.stats.crits).toBe(3);
    expect(s.stats.biggestHit).toBe(8);
    expect(s.stats.damageByHero).toEqual({ a: 8, b: 7 });
  });

  it('CONFIRM_PARTY resets run stats', () => {
    let s = gameReducer(initialState, { type: 'RECORD', delta: { crits: 5 } });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.stats.crits).toBe(0);
  });

  it('ADVANCE_CAMPAIGN keeps run stats accumulating', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    s = gameReducer(s, { type: 'RECORD', delta: { encountersWon: 2 } });
    s = gameReducer(s, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.stats.encountersWon).toBe(2);
  });

  it('ADD_ITEM adds, increments, decrements, and prunes at zero', () => {
    let s = gameReducer(initialState, { type: 'ADD_ITEM', itemId: 'potion-healing', delta: 1 });
    expect(s.inventory['potion-healing']).toBe(1);
    s = gameReducer(s, { type: 'ADD_ITEM', itemId: 'potion-healing', delta: 2 });
    expect(s.inventory['potion-healing']).toBe(3);
    s = gameReducer(s, { type: 'ADD_ITEM', itemId: 'potion-healing', delta: -3 });
    expect(s.inventory['potion-healing']).toBeUndefined();
  });

  it('CONFIRM_PARTY clears the inventory', () => {
    let s = gameReducer(initialState, { type: 'ADD_ITEM', itemId: 'potion-healing', delta: 2 });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.inventory).toEqual({});
  });

  it('ADVANCE_CAMPAIGN carries the inventory across tales', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    s = gameReducer(s, { type: 'ADD_ITEM', itemId: 'smoke-bomb', delta: 1 });
    s = gameReducer(s, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.inventory['smoke-bomb']).toBe(1);
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
