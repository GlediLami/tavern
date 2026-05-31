import type { Adventure, Scene, Choice } from '../types';

export function getScene(adventure: Adventure, id: string): Scene {
  const scene = adventure.scenes[id];
  if (!scene) throw new Error(`Unknown scene id: "${id}"`);
  return scene;
}

// Given a chosen choice and (optional) check success, return the next scene id.
export function resolveChoice(choice: Choice, checkSuccess: boolean | null): string {
  if (choice.check) {
    if (checkSuccess === null) {
      throw new Error(`Choice "${choice.id}" requires a check result`);
    }
    const target = checkSuccess ? choice.onSuccess : choice.onFailure;
    if (!target) throw new Error(`Choice "${choice.id}" missing branch target`);
    return target;
  }
  if (!choice.next) throw new Error(`Choice "${choice.id}" has no next target`);
  return choice.next;
}
