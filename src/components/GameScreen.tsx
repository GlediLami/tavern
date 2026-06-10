import { useMemo, useState } from 'react';
import { useGame } from '../state/GameContext';
import { getScene, resolveChoice } from '../engine/story';
import { getAdventure, getCharacter, heroDisplayName } from '../engine/party';
import { getItem } from '../engine/items';
import { rollRelicChoices, getRelic } from '../engine/relics';
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
  | { stage: 'reveal'; choice: Choice; heroId: string; heroName: string; result: CheckResult; nonce: number };

export function GameScreen() {
  const { state, dispatch } = useGame();
  const adventure = getAdventure(state.adventureId);
  const scene = getScene(adventure, state.sceneId);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingRelic, setPendingRelic] = useState<string | null>(null);
  const drafting = state.draftsAvailable > 0;
  const draftChoices = useMemo(() => (state.draftsAvailable > 0 ? rollRelicChoices(defaultRng, 3) : []), [state.draftsAvailable]);

  if (scene.type !== 'story') return null; // combat/ending handled by other screens

  const consciousHeroes = state.partyIds.filter((id) => (state.hp[id] ?? 0) > 0);

  function pickChoice(choice: Choice) {
    sfx.click();
    if (choice.setFlags && choice.setFlags.length) dispatch({ type: 'SET_FLAGS', flags: choice.setFlags });
    if (!choice.check) {
      dispatch({ type: 'GOTO_SCENE', sceneId: resolveChoice(choice, null) });
      return;
    }
    setPending({ stage: 'choose-hero', choice });
  }

  function attemptWith(heroId: string) {
    if (!pending || pending.stage !== 'choose-hero' || !pending.choice.check) return;
    const hero = getCharacter(heroId);
    const name = heroDisplayName(heroId, state.playerNames);
    const { skill, dc } = pending.choice.check;
    const result = resolveCheck(hero, skill, dc, defaultRng);
    dispatch({
      type: 'LOG',
      entry: `${name} rolled ${result.roll}${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total} vs DC ${dc} — ${result.success ? 'success' : 'failure'}.`,
    });
    setPending({ stage: 'reveal', choice: pending.choice, heroId, heroName: name, result, nonce: 0 });
  }

  function rerollCheck() {
    if (!pending || pending.stage !== 'reveal' || !pending.choice.check || state.luck <= 0) return;
    sfx.click();
    const hero = getCharacter(pending.heroId);
    const { skill, dc } = pending.choice.check;
    const result = resolveCheck(hero, skill, dc, defaultRng);
    dispatch({ type: 'SPEND_LUCK' });
    dispatch({ type: 'LOG', entry: `${pending.heroName} spends Luck and rerolls: ${result.roll}${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total} vs DC ${dc} — ${result.success ? 'success' : 'failure'}.` });
    setPending({ ...pending, result, nonce: pending.nonce + 1 });
  }

  function finishReveal() {
    if (!pending || pending.stage !== 'reveal') return;
    dispatch({ type: 'RECORD', delta: pending.result.success ? { checksPassed: 1 } : { checksFailed: 1 } });
    const next = resolveChoice(pending.choice, pending.result.success);
    setPending(null);
    dispatch({ type: 'GOTO_SCENE', sceneId: next });
  }

  return (
    <div className="app-shell screen game-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: 22, alignItems: 'start' }}>
      <div>
        {drafting && (
          <div className="panel panel--framed" style={{ marginBottom: 16 }}>
            <h3 className="scene-title" style={{ marginTop: 0 }}>Choose a Boon</h3>
            <div className="scene-rule" />
            {!pendingRelic ? (
              <>
                <p className="muted">Claim a relic for one of your heroes.</p>
                <div className="stack">
                  {draftChoices.map((id) => {
                    const r = getRelic(id);
                    return (
                      <button key={id} className="btn btn-choice" onClick={() => { sfx.click(); setPendingRelic(id); }}>
                        <strong>✦ {r.name}</strong> — {r.description}
                      </button>
                    );
                  })}
                </div>
                <button className="btn" style={{ marginTop: 10 }} onClick={() => { sfx.click(); dispatch({ type: 'SKIP_DRAFT' }); }}>Skip this boon</button>
              </>
            ) : (
              <>
                <p className="muted">Give <strong className="accent-text">✦ {getRelic(pendingRelic).name}</strong> to:</p>
                <div className="row">
                  {state.partyIds.map((id) => (
                    <button key={id} className="btn btn-primary" onClick={() => { sfx.click(); dispatch({ type: 'GRANT_RELIC', heroId: id, relicId: pendingRelic }); setPendingRelic(null); }}>
                      {getCharacter(id).portrait} {heroDisplayName(id, state.playerNames)}
                    </button>
                  ))}
                </div>
                <button className="btn" style={{ marginTop: 10 }} onClick={() => { sfx.click(); setPendingRelic(null); }}>← Back</button>
              </>
            )}
          </div>
        )}
        <NarrationLog entries={state.log} />
        <div className="panel panel--framed corner-frame">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <h2 className="scene-title">{scene.title}</h2>
          <div className="scene-rule" />
          <p style={{ lineHeight: 1.72, fontSize: '1.12rem' }}>{scene.narration}</p>

          {pending?.stage === 'reveal' ? (
            <DiceRoller
              key={pending.nonce}
              heroName={pending.heroName}
              skillLabel={skillLabel(pending.choice.check!.skill)}
              result={pending.result}
              onContinue={finishReveal}
              onReroll={rerollCheck}
              rerollsLeft={state.luck}
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
                    {getCharacter(id).portrait} {heroDisplayName(id, state.playerNames)}
                  </button>
                ))}
              </div>
              <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => { sfx.click(); setPending(null); }}>← Back</button>
            </div>
          ) : (
            <div className="stack" style={{ marginTop: 16 }}>
              {scene.choices.filter((c) => !c.requiresFlag || state.flags.includes(c.requiresFlag)).map((c) => (
                <button key={c.id} className="btn btn-choice" onClick={() => pickChoice(c)}>
                  {c.text}
                  {c.check && (
                    <span className="stat-pill" style={{ marginLeft: 8 }} title="Roll a d20, add the hero's skill modifier, and meet or beat the Difficulty Class (DC). A natural 20 is a critical success, a natural 1 a critical failure.">
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
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 10px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>The Party</h3>
          <span className="stat-pill" title="Spend a Luck token to reroll a check or gain advantage in combat">✦ Luck {state.luck}</span>
        </div>
        <PartyPanel partyIds={state.partyIds} hp={state.hp} difficulty={state.difficulty} level={state.campaign?.level ?? 1} relics={state.relics} playerNames={state.playerNames} />
        {Object.keys(state.inventory).length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Satchel</h3>
            <div className="panel" style={{ padding: 12 }}>
              {Object.entries(state.inventory).map(([id, n]) => (
                <div key={id} className="row" style={{ justifyContent: 'space-between', gap: 8, fontSize: '0.88rem', padding: '2px 0' }}>
                  <span>{getItem(id).name}</span>
                  <span className="muted">×{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
