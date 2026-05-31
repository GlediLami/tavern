import { useState } from 'react';
import { useGame } from '../state/GameContext';
import { getScene, resolveChoice } from '../engine/story';
import { getAdventure, getCharacter } from '../engine/party';
import { resolveCheck } from '../engine/checks';
import { skillLabel } from '../engine/skills';
import { defaultRng } from '../engine/rng';
import type { Choice, CheckResult } from '../types';
import { PartyPanel } from './PartyPanel';
import { NarrationLog } from './NarrationLog';
import { DiceRoller } from './DiceRoller';

type Pending =
  | { stage: 'choose-hero'; choice: Choice }
  | { stage: 'reveal'; choice: Choice; heroName: string; result: CheckResult };

export function GameScreen() {
  const { state, dispatch } = useGame();
  const adventure = getAdventure();
  const scene = getScene(adventure, state.sceneId);
  const [pending, setPending] = useState<Pending | null>(null);

  if (scene.type !== 'story') return null; // combat/ending handled by other screens

  const consciousHeroes = state.partyIds.filter((id) => (state.hp[id] ?? 0) > 0);

  function pickChoice(choice: Choice) {
    if (!choice.check) {
      dispatch({ type: 'GOTO_SCENE', sceneId: resolveChoice(choice, null) });
      return;
    }
    setPending({ stage: 'choose-hero', choice });
  }

  function attemptWith(heroId: string) {
    if (!pending || pending.stage !== 'choose-hero' || !pending.choice.check) return;
    const hero = getCharacter(heroId);
    const { skill, dc } = pending.choice.check;
    const result = resolveCheck(hero, skill, dc, defaultRng);
    dispatch({
      type: 'LOG',
      entry: `${hero.name} rolled ${result.roll}${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total} vs DC ${dc} — ${result.success ? 'success' : 'failure'}.`,
    });
    setPending({ stage: 'reveal', choice: pending.choice, heroName: hero.name, result });
  }

  function finishReveal() {
    if (!pending || pending.stage !== 'reveal') return;
    const next = resolveChoice(pending.choice, pending.result.success);
    setPending(null);
    dispatch({ type: 'GOTO_SCENE', sceneId: next });
  }

  return (
    <div className="app-shell" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
      <div>
        <NarrationLog entries={state.log} />
        <div className="panel">
          <h2 style={{ color: 'var(--gold-bright)', marginTop: 0 }}>{scene.title}</h2>
          <p style={{ lineHeight: 1.6 }}>{scene.narration}</p>

          {pending?.stage === 'reveal' ? (
            <DiceRoller
              heroName={pending.heroName}
              skillLabel={skillLabel(pending.choice.check!.skill)}
              result={pending.result}
              onContinue={finishReveal}
            />
          ) : pending?.stage === 'choose-hero' ? (
            <div className="stack">
              <p className="muted">Who attempts the {skillLabel(pending.choice.check!.skill)} check (DC {pending.choice.check!.dc})?</p>
              <div className="row">
                {consciousHeroes.map((id) => (
                  <button key={id} className="btn" onClick={() => attemptWith(id)}>
                    {getCharacter(id).name}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => setPending(null)}>Back</button>
            </div>
          ) : (
            <div className="stack" style={{ marginTop: 12 }}>
              {scene.choices.map((c) => (
                <button key={c.id} className="btn" onClick={() => pickChoice(c)}>
                  {c.text}
                  {c.check && <span className="muted"> · {skillLabel(c.check.skill)} DC {c.check.dc}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <PartyPanel partyIds={state.partyIds} hp={state.hp} />
    </div>
  );
}
