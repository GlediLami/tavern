import { useState } from 'react';
import { useGame } from '../state/GameContext';
import { getScene, resolveChoice } from '../engine/story';
import { getAdventure, getCharacter } from '../engine/party';
import { resolveCheck } from '../engine/checks';
import { skillLabel } from '../engine/skills';
import { defaultRng } from '../engine/rng';
import { sfx } from '../ui/sfx';
import type { Choice, CheckResult } from '../types';
import { PartyPanel } from './PartyPanel';
import { NarrationLog } from './NarrationLog';
import { DiceRoller } from './DiceRoller';

type Pending =
  | { stage: 'choose-hero'; choice: Choice }
  | { stage: 'reveal'; choice: Choice; heroName: string; result: CheckResult };

export function GameScreen() {
  const { state, dispatch } = useGame();
  const adventure = getAdventure(state.adventureId);
  const scene = getScene(adventure, state.sceneId);
  const [pending, setPending] = useState<Pending | null>(null);

  if (scene.type !== 'story') return null; // combat/ending handled by other screens

  const consciousHeroes = state.partyIds.filter((id) => (state.hp[id] ?? 0) > 0);

  function pickChoice(choice: Choice) {
    sfx.click();
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
    <div className="app-shell screen game-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 22, alignItems: 'start' }}>
      <div>
        <NarrationLog entries={state.log} />
        <div className="panel panel--framed corner-frame">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <h2 className="scene-title">{scene.title}</h2>
          <div className="scene-rule" />
          <p style={{ lineHeight: 1.72, fontSize: '1.12rem' }}>{scene.narration}</p>

          {pending?.stage === 'reveal' ? (
            <DiceRoller
              heroName={pending.heroName}
              skillLabel={skillLabel(pending.choice.check!.skill)}
              result={pending.result}
              onContinue={finishReveal}
            />
          ) : pending?.stage === 'choose-hero' ? (
            <div className="stack" style={{ marginTop: 8 }}>
              <p className="muted">
                Who attempts the <span className="engraved">{skillLabel(pending.choice.check!.skill)}</span> check
                {' '}(DC {pending.choice.check!.dc})?
              </p>
              <div className="row">
                {consciousHeroes.map((id) => (
                  <button key={id} className="btn" onClick={() => { sfx.click(); attemptWith(id); }}>
                    {getCharacter(id).portrait} {getCharacter(id).name}
                  </button>
                ))}
              </div>
              <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => { sfx.click(); setPending(null); }}>← Back</button>
            </div>
          ) : (
            <div className="stack" style={{ marginTop: 16 }}>
              {scene.choices.map((c) => (
                <button key={c.id} className="btn btn-choice" onClick={() => pickChoice(c)}>
                  {c.text}
                  {c.check && (
                    <span className="stat-pill" style={{ marginLeft: 8 }}>
                      {skillLabel(c.check.skill)} · DC {c.check.dc}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>The Party</h3>
        <PartyPanel partyIds={state.partyIds} hp={state.hp} difficulty={state.difficulty} level={state.campaign?.level ?? 1} />
      </div>
    </div>
  );
}
