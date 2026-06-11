# Combat Juice + Procedural Ambient Music (Ship C) — Design

Date: 2026-06-11
Status: Approved (autonomous — owner asked to complete B and C without per-feature approval)

Final combat-depth ship: the "feel" layer. Impact feedback on hits, and a synthesized ambient
music bed — both respecting the existing mute and reduced-motion settings.

## 1. Combat juice (`CombatView.tsx`, `ui/visuals.ts`, `theme.css`)
- Pure helper `shakeIntensity(amount, crit): number` (px) in `visuals.ts`: 0 for ≤0; ~3 (small),
  ~6 (medium), ~10 (big) by damage; **12 on a crit**. Unit-tested.
- In `applyResult`, when an attack deals damage and motion is allowed (`!prefersReducedMotion()`):
  - **Screen shake** — imperative `element.animate(...)` on the combat-root ref (no remount, no CSS
    keyframes; guarded so jsdom/no-`animate` is a no-op).
  - **Crit flash** — on a crit, a brief opacity pulse on a fixed overlay ref (warm tint).
  - SFX already fires (`sfx.hit`); add `sfx.crit()` on a crit hit.
- Fully gated by `prefersReducedMotion()` — reduced-motion users get the existing damage-number
  pop and SFX only, no shake/flash.

## 2. Procedural ambient music (`ui/music.ts`, new)
- Web Audio, asset-free, fail-silent (mirrors `sfx.ts`); respects the mute key `tavern.muted.v1`.
- Scenes: `'explore'` (calm low drone, slow gain breathing), `'combat'` (a touch higher + a tense
  minor interval + soft pulse), `'none'` (silent). `setMusicScene(scene)` crossfades; `currentScene()`
  returns state; `stopMusic()` tears down.
- Integration: a `useEffect` in `App`'s screen container maps `state.phase` → scene (`combat`→combat,
  `home`→none, else explore). The mute toggle stops music when muting and re-applies the scene when
  unmuting. Audio only starts after a user gesture (already guaranteed by gameplay clicks).

## Testing (TDD)
- `visuals.test.ts`: `shakeIntensity` — 0 for no damage, scales up, max on crit.
- `music.test.ts`: `setMusicScene` updates `currentScene()` and never throws without an AudioContext
  (jsdom); muting yields `'none'`-equivalent silence path without error.
- Regression: existing `CombatView`/component tests stay green (juice is reduced-motion-gated and the
  test env reports reduced motion, so shake/flash no-op in jsdom).

Then full `lint && tsc && test && build` green, a Playwright spot-check (combat renders, hits play,
no console errors; music context initialises without throwing), commit, push to `main`.

## Out of scope
Per-status SFX; music for non-combat stings beyond the existing victory/defeat SFX; a separate
music volume slider (music follows the single mute toggle).
