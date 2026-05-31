import brackenmoorData from './adventure.json';
import snakewaterData from './snakewater.json';
import type { Adventure } from '../types';

export interface AdventureEntry {
  id: string;
  title: string;
  tagline: string;
  mood: string;       // short vibe line
  emoji: string;
  data: Adventure;
}

export const ADVENTURES: AdventureEntry[] = [
  {
    id: 'brackenmoor',
    title: (brackenmoorData as unknown as Adventure).title,
    tagline: 'A village bell tolls itself at midnight, and those who climb the tower never return.',
    mood: 'Haunted · Undead · Night',
    emoji: '🔔',
    data: brackenmoorData as unknown as Adventure,
  },
  {
    id: 'snakewater',
    title: (snakewaterData as unknown as Adventure).title,
    tagline: 'Raiders torched the mill and stole the miller’s daughter. Storm the smuggler caves and bring her home.',
    mood: 'Daylight · Rescue · Bandits',
    emoji: '🏞️',
    data: snakewaterData as unknown as Adventure,
  },
];

const BY_ID: Record<string, AdventureEntry> = Object.fromEntries(ADVENTURES.map((a) => [a.id, a]));

export const DEFAULT_ADVENTURE_ID = ADVENTURES[0].id;

export function getAdventureEntry(id: string): AdventureEntry {
  return BY_ID[id] ?? ADVENTURES[0];
}

export function getAdventureData(id: string): Adventure {
  return getAdventureEntry(id).data;
}
