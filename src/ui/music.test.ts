import { describe, it, expect } from 'vitest';
import { setMusicScene, refreshMusic, currentScene, stopMusic } from './music';

describe('music', () => {
  it('tracks the desired scene and never throws without an AudioContext', () => {
    setMusicScene('combat');
    expect(currentScene()).toBe('combat');
    setMusicScene('explore');
    expect(currentScene()).toBe('explore');
    expect(() => refreshMusic()).not.toThrow();
    stopMusic();
    expect(currentScene()).toBe('none');
  });
});
