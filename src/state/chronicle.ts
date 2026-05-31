import { getAdventureEntry } from '../content/adventures';

const KEY = 'tavern.chronicle.v1';

export interface Chronicle {
  endings: Record<string, string[]>; // adventureId -> discovered ending scene ids
  campaignWon: boolean;
}

function read(): Chronicle {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Chronicle>;
      if (p && typeof p === 'object') {
        return { endings: p.endings ?? {}, campaignWon: !!p.campaignWon };
      }
    }
  } catch { /* ignore */ }
  return { endings: {}, campaignWon: false };
}

function write(c: Chronicle): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export function loadChronicle(): Chronicle {
  return read();
}

export function recordEnding(adventureId: string, endingId: string): void {
  const c = read();
  const list = c.endings[adventureId] ?? [];
  if (!list.includes(endingId)) {
    c.endings[adventureId] = [...list, endingId];
    write(c);
  }
}

export function recordCampaignWon(): void {
  const c = read();
  if (!c.campaignWon) { c.campaignWon = true; write(c); }
}

export function clearChronicle(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// All ending scenes (id + title) for an adventure, used for "discovered / total".
export function endingsOf(adventureId: string): { id: string; title: string }[] {
  const adventure = getAdventureEntry(adventureId).data;
  return Object.values(adventure.scenes)
    .filter((s) => s.type === 'ending')
    .map((s) => ({ id: s.id, title: s.title }));
}
