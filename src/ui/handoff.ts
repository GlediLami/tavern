// Pass-and-play "pass the device" handoff toggle, persisted in localStorage. Default off.
const HANDOFF_KEY = 'tavern.handoff.v1';

export function isHandoffOn(): boolean {
  try { return localStorage.getItem(HANDOFF_KEY) === '1'; } catch { return false; }
}

export function setHandoffOn(on: boolean): void {
  try { localStorage.setItem(HANDOFF_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}
