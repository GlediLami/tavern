import { loadGame, clearSave } from '../engine/save';
import { getAdventureEntry } from '../content/adventures';
import { getAllCharacters } from '../engine/party';
import type { GameState, Phase } from './gameReducer';

const PHASES: Phase[] = ['home', 'adventure-select', 'party-select', 'scene', 'combat', 'ending'];
const HERO_IDS = new Set(getAllCharacters().map((c) => c.id));

// A saved game can be stale (an older shape, a renamed scene, a removed hero).
// Loading such a save unchecked would throw deep in rendering and white-screen
// the app, so validate it and discard anything we can't safely resume.
function isValid(s: unknown): s is GameState {
  if (!s || typeof s !== 'object') return false;
  const g = s as Record<string, unknown>;

  if (!PHASES.includes(g.phase as Phase)) return false;
  if (typeof g.adventureId !== 'string') return false;
  if (g.difficulty !== 'normal' && g.difficulty !== 'hard') return false;
  if (!Array.isArray(g.partyIds)) return false;
  if (typeof g.sceneId !== 'string') return false;
  if (!g.hp || typeof g.hp !== 'object') return false;
  if (!Array.isArray(g.log)) return false;

  // Optional campaign fields (backward compatible: missing mode ⇒ single).
  if (g.mode !== undefined && g.mode !== 'single' && g.mode !== 'campaign') return false;
  if (g.campaign !== undefined) {
    const c = g.campaign as Record<string, unknown>;
    if (!c || typeof c !== 'object') return false;
    if (!Array.isArray(c.order) || !c.order.every((x) => typeof x === 'string')) return false;
    if (typeof c.index !== 'number' || c.index < 0 || c.index >= c.order.length) return false;
    if (typeof c.level !== 'number' || c.level < 1) return false;
  }

  // Every saved hero must still exist.
  if (!(g.partyIds as unknown[]).every((id) => typeof id === 'string' && HERO_IDS.has(id))) return false;

  // For in-progress phases the scene must still exist in the chosen adventure,
  // and the party must be non-empty.
  const inGame = g.phase === 'scene' || g.phase === 'combat' || g.phase === 'ending';
  if (inGame) {
    if ((g.partyIds as unknown[]).length === 0) return false;
    const adventure = getAdventureEntry(g.adventureId as string).data;
    if (!adventure.scenes[g.sceneId as string]) return false;
  }
  return true;
}

// Load a saved game only if it is structurally sound; otherwise drop it.
export function loadValidatedGame(): GameState | null {
  const raw = loadGame<GameState>();
  if (raw && isValid(raw)) return raw;
  if (raw) clearSave(); // prune the unusable save so "Continue" disappears
  return null;
}
