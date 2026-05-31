import { describe, it, expect, beforeEach } from 'vitest';
import { loadChronicle, recordEnding, recordCampaignWon, clearChronicle, endingsOf } from './chronicle';

describe('chronicle', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(loadChronicle()).toEqual({ endings: {}, campaignWon: false });
  });

  it('records endings without duplicates', () => {
    recordEnding('brackenmoor', 'ending_victory');
    recordEnding('brackenmoor', 'ending_victory');
    recordEnding('brackenmoor', 'ending_pack');
    expect(loadChronicle().endings.brackenmoor.sort()).toEqual(['ending_pack', 'ending_victory']);
  });

  it('records campaign completion', () => {
    recordCampaignWon();
    expect(loadChronicle().campaignWon).toBe(true);
  });

  it('clearChronicle empties it', () => {
    recordEnding('arena', 'ending_pit_win');
    clearChronicle();
    expect(loadChronicle()).toEqual({ endings: {}, campaignWon: false });
  });

  it("endingsOf returns an adventure's ending scenes", () => {
    const ids = endingsOf('brackenmoor').map((e) => e.id);
    expect(ids).toContain('ending_victory');
    expect(ids).toContain('ending_pack');
    expect(endingsOf('brackenmoor').length).toBeGreaterThanOrEqual(3);
  });
});
