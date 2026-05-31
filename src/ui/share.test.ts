import { describe, it, expect } from 'vitest';
import { buildShareText } from './share';
import { emptyStats } from '../state/gameReducer';

describe('buildShareText', () => {
  it('includes title, difficulty, level, MVP and crits', () => {
    const text = buildShareText(
      { ...emptyStats, crits: 2, biggestHit: 14, encountersWon: 3 },
      { title: 'The Snakewater Raid', difficulty: 'normal', level: 2, outcome: 'victory', isCampaign: false, mvpName: 'Gronk Skullsplitter' },
    );
    expect(text).toContain('The Snakewater Raid');
    expect(text).toContain('Level 2');
    expect(text).toContain('MVP: Gronk Skullsplitter');
    expect(text).toContain('2 crits');
    expect(text).toMatch(/Normal/);
  });

  it('omits the MVP clause when there is no MVP', () => {
    const text = buildShareText(emptyStats, { title: 'X', difficulty: 'hard', level: 1, outcome: 'defeat', isCampaign: false });
    expect(text).not.toContain('MVP');
    expect(text).toContain('Hard');
    expect(text).toContain('fell in');
  });
});
