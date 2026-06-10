import { useEffect, useState } from 'react';
import { getAdventure, getCharacter } from '../engine/party';
import { getAdventureEntry } from '../content/adventures';
import { getScene } from '../engine/story';
import { recordEnding, recordCampaignWon } from '../state/chronicle';
import { buildShareText, shareOrCopy } from '../ui/share';
import { sfx } from '../ui/sfx';
import type { Difficulty } from '../types';
import type { CampaignState, RunStats } from '../state/gameReducer';

interface Props {
  mode: 'single' | 'campaign';
  adventureId: string;
  sceneId: string;
  difficulty: Difficulty;
  level: number;
  stats: RunStats;
  campaign?: CampaignState;
  flags?: string[];
  onReturn: () => void;
  onAdvance: () => void;
}

function mvp(stats: RunStats): string | undefined {
  const entries = Object.entries(stats.damageByHero);
  if (entries.length === 0) return undefined;
  const [id] = entries.reduce((best, e) => (e[1] > best[1] ? e : best));
  try { return getCharacter(id).name; } catch { return undefined; }
}

export function EndingScreen({ mode, adventureId, sceneId, difficulty, level, stats, campaign, flags = [], onReturn, onAdvance }: Props) {
  const scene = getScene(getAdventure(adventureId), sceneId);
  const victory = scene.type === 'ending' && scene.endingType === 'victory';
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const inCampaign = mode === 'campaign' && !!campaign;
  const hasNext = inCampaign && campaign!.index < campaign!.order.length - 1;
  const advancing = inCampaign && victory && hasNext;

  // Record the ending in the persistent chronicle (once per mount).
  useEffect(() => {
    if (scene.type !== 'ending') return;
    recordEnding(adventureId, sceneId);
    if (inCampaign && victory && !hasNext) recordCampaignWon();
    if (victory) sfx.victory(); else sfx.defeat();
  }, [scene.type, adventureId, sceneId, inCampaign, victory, hasNext]);

  if (scene.type !== 'ending') return null;

  const nextTitle = hasNext ? getAdventureEntry(campaign!.order[campaign!.index + 1]).title : '';
  const mvpName = mvp(stats);

  async function onShare() {
    const text = buildShareText(stats, {
      title: inCampaign ? 'the Tavern campaign' : getAdventureEntry(adventureId).title,
      difficulty, level, outcome: victory ? 'victory' : 'defeat', isCampaign: inCampaign, mvpName,
    });
    const result = await shareOrCopy(text);
    setShareMsg(result === 'shared' ? 'Shared!' : result === 'copied' ? 'Copied to clipboard!' : 'Could not share');
  }

  const stat = (label: string, value: string | number) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '3px 0' }}>
      <span className="muted">{label}</span><strong>{value}</strong>
    </div>
  );

  return (
    <div className="app-shell screen center" style={{ paddingTop: '9vh' }}>
      <div style={{ fontSize: '3.4rem', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))' }}>
        {victory ? '🏆' : '💀'}
      </div>
      <h1 className="title-xl" style={{ color: victory ? 'var(--gold)' : 'var(--accent-bright)', textShadow: victory ? '0 2px 22px rgba(217,164,65,0.3)' : '0 2px 22px rgba(230,59,80,0.3)' }}>
        {scene.title}
      </h1>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.35em', fontWeight: 700, color: victory ? 'var(--gold)' : 'var(--accent-bright)', marginTop: 6 }}>
        {scene.endingType}
      </p>
      <div className="rule-accent" style={{ maxWidth: 240, margin: '16px auto', background: victory ? 'linear-gradient(90deg, transparent, var(--gold), transparent)' : 'linear-gradient(90deg, transparent, var(--accent-bright), transparent)' }} />
      <p className="subtitle" style={{ maxWidth: 600, margin: '0 auto 28px', lineHeight: 1.8, fontSize: '1.12rem' }}>
        {scene.narration}
      </p>

      {scene.epilogues && scene.epilogues.some((e) => flags.includes(e.flag)) && (
        <div style={{ maxWidth: 600, margin: '0 auto 26px' }}>
          {scene.epilogues.filter((e) => flags.includes(e.flag)).map((e) => (
            <p key={e.flag} className="muted" style={{ fontStyle: 'italic', lineHeight: 1.7, margin: '0 0 8px' }}>{e.text}</p>
          ))}
        </div>
      )}

      {advancing && (
        <div className="panel panel--framed" style={{ maxWidth: 460, margin: '0 auto 26px' }}>
          <p className="accent-text" style={{ fontWeight: 700, fontSize: '1.15rem', margin: 0 }}>Your party reaches Level {campaign!.level + 1}!</p>
          <p className="muted" style={{ margin: '6px 0 0' }}>+4 max HP, +1 power use, and all wounds are mended.</p>
        </div>
      )}

      {!advancing && (
        <div className="panel panel--framed" style={{ maxWidth: 460, margin: '0 auto 22px', textAlign: 'left' }}>
          <h3 className="display" style={{ marginTop: 0, fontSize: '1.1rem' }}>Run Summary</h3>
          {stat('Party level', level)}
          {mvpName && stat('MVP', mvpName)}
          {stat('Fights won', stats.encountersWon)}
          {stat('Checks passed / failed', `${stats.checksPassed} / ${stats.checksFailed}`)}
          {stat('Heroes downed', stats.heroesDowned)}
          {stat('Critical hits', stats.crits)}
          {stat('Biggest hit', stats.biggestHit)}
          <div className="row" style={{ marginTop: 14, alignItems: 'center', gap: 10 }}>
            <button className="btn" onClick={() => { sfx.click(); onShare(); }}>📋 Share result</button>
            {shareMsg && <span className="accent-text" style={{ fontSize: '0.9rem' }}>{shareMsg}</span>}
          </div>
        </div>
      )}

      {inCampaign && !advancing && (
        <p className="muted" style={{ marginBottom: 22 }}>
          {victory
            ? `The campaign is won — your party stands undefeated at Level ${campaign!.level}.`
            : `You fell in ${getAdventureEntry(adventureId).title}. Tales completed: ${campaign!.index}. Party level: ${campaign!.level}.`}
        </p>
      )}

      {advancing ? (
        <button className="btn btn-primary" style={{ fontSize: '1.02rem', padding: '13px 28px' }} onClick={() => { sfx.click(); onAdvance(); }}>
          Onward to {nextTitle} →
        </button>
      ) : (
        <button className="btn btn-primary" style={{ fontSize: '1.02rem', padding: '13px 28px' }} onClick={() => { sfx.click(); onReturn(); }}>
          Return to the Tavern
        </button>
      )}
    </div>
  );
}
