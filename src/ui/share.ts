import type { Difficulty } from '../types';
import type { RunStats } from '../state/gameReducer';

export interface ShareContext {
  title: string;
  difficulty: Difficulty;
  level: number;
  outcome: 'victory' | 'defeat';
  isCampaign: boolean;
  mvpName?: string;
}

const PLAY_URL = 'https://gledilami.github.io/tavern/';

export function buildShareText(stats: RunStats, ctx: ShareContext): string {
  const verb = ctx.outcome === 'victory' ? 'cleared' : 'fell in';
  const diff = ctx.difficulty === 'hard' ? 'Hard' : 'Normal';
  const what = ctx.isCampaign ? 'the Tavern campaign' : `"${ctx.title}"`;
  const bits: string[] = [];
  if (ctx.mvpName) bits.push(`MVP: ${ctx.mvpName}`);
  if (stats.crits) bits.push(`${stats.crits} crit${stats.crits > 1 ? 's' : ''}`);
  if (stats.biggestHit) bits.push(`biggest hit ${stats.biggestHit}`);
  if (stats.encountersWon) bits.push(`${stats.encountersWon} fight${stats.encountersWon > 1 ? 's' : ''} won`);
  const tail = bits.length ? ` ${bits.join(' · ')}.` : '';
  return `⚔️ Tavern — I ${verb} ${what} on ${diff} at Level ${ctx.level}.${tail} Play: ${PLAY_URL}`;
}

// Try the native share sheet, fall back to clipboard. Never throws.
export async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : undefined;
    if (nav?.share) { await nav.share({ text }); return 'shared'; }
    if (nav?.clipboard) { await nav.clipboard.writeText(text); return 'copied'; }
    return 'failed';
  } catch {
    return 'failed';
  }
}
