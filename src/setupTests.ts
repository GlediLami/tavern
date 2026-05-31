import '@testing-library/jest-dom';

// jsdom doesn't implement matchMedia. Report "reduced motion" in tests so
// animated components (e.g. DiceRoller) render their final state instantly
// and assertions stay deterministic.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: /prefers-reduced-motion/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
