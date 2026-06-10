import { describe, it, expect, beforeEach } from 'vitest';
import { isHandoffOn, setHandoffOn } from './handoff';

describe('handoff setting', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to off', () => {
    expect(isHandoffOn()).toBe(false);
  });

  it('persists when turned on', () => {
    setHandoffOn(true);
    expect(isHandoffOn()).toBe(true);
    setHandoffOn(false);
    expect(isHandoffOn()).toBe(false);
  });
});
