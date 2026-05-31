import { useState } from 'react';
import { ADVENTURES, getAdventureEntry } from '../content/adventures';
import { DIFFICULTIES } from '../engine/difficulty';
import { CAMPAIGN_ORDER } from '../state/gameReducer';
import { sfx } from '../ui/sfx';
import type { Difficulty } from '../types';

interface Props {
  onSingle: (adventureId: string, difficulty: Difficulty) => void;
  onCampaign: (difficulty: Difficulty) => void;
}

const DIFFS: Difficulty[] = ['normal', 'hard'];
type Mode = 'single' | 'campaign';

export function AdventureSelect({ onSingle, onCampaign }: Props) {
  const [mode, setMode] = useState<Mode>('single');
  const [adventureId, setAdventureId] = useState<string>(ADVENTURES[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  return (
    <div className="app-shell screen">
      <h2 className="display" style={{ fontSize: '2rem', marginBottom: 2 }}>Choose Your Tale</h2>
      <div className="rule-accent" />

      <div className="row" style={{ marginBottom: 18 }}>
        {(['single', 'campaign'] as Mode[]).map((m) => (
          <button
            key={m}
            className={`panel choose-card${mode === m ? ' selected' : ''}`}
            style={{ flex: '1 1 260px', textAlign: 'left' }}
            onClick={() => { sfx.click(); setMode(m); }}
          >
            <strong className="display" style={{ fontSize: '1.15rem' }}>{m === 'single' ? 'Single Tale' : 'Campaign'}</strong>
            <p className="muted" style={{ fontSize: '0.9rem', margin: '6px 0 0' }}>
              {m === 'single'
                ? 'Play one adventure of your choice.'
                : 'Chain all four tales with a party that levels up between them.'}
            </p>
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <>
          <p className="muted">Pick a tale, set the challenge, then gather your party.</p>
          <div className="grid-cards stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {ADVENTURES.map((a) => {
              const sel = adventureId === a.id;
              return (
                <button
                  key={a.id}
                  className={`panel choose-card${sel ? ' selected' : ''}`}
                  onClick={() => { sfx.click(); setAdventureId(a.id); }}
                >
                  <div style={{ fontSize: '2.4rem' }}>{a.emoji}</div>
                  <h3 className="display" style={{ margin: '6px 0 2px', fontSize: '1.3rem' }}>{a.title}</h3>
                  <div className="tag" style={{ marginBottom: 8 }}>{a.mood}</div>
                  <p className="muted" style={{ fontSize: '0.98rem', margin: 0 }}>{a.tagline}</p>
                  {a.attribution && <p className="faint" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{a.attribution}</p>}
                  {sel && <div className="accent-text" style={{ fontWeight: 700, marginTop: 10 }}>✓ Selected</div>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="muted">Face all four tales in order. Survive each and your party grows stronger.</p>
          <div className="stack">
            {CAMPAIGN_ORDER.map((id, i) => {
              const a = getAdventureEntry(id);
              return (
                <div key={id} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="tag">Bout {i + 1}</span>
                  <span style={{ fontSize: '1.5rem' }}>{a.emoji}</span>
                  <strong className="display">{a.title}</strong>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3 style={{ margin: '26px 0 6px', fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Difficulty</h3>
      <div className="row">
        {DIFFS.map((d) => {
          const cfg = DIFFICULTIES[d];
          const sel = difficulty === d;
          return (
            <button
              key={d}
              className={`panel choose-card${sel ? ' selected' : ''}`}
              style={{ flex: '1 1 280px', textAlign: 'left' }}
              onClick={() => { sfx.click(); setDifficulty(d); }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <strong className="display" style={{ fontSize: '1.15rem' }}>{cfg.label}</strong>
                {sel && <span className="accent-text" style={{ fontWeight: 700 }}>✓</span>}
              </div>
              <p className="muted" style={{ fontSize: '0.92rem', margin: '6px 0 0' }}>{cfg.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: '1.02rem', padding: '13px 26px' }}
          onClick={() => { sfx.click(); if (mode === 'single') onSingle(adventureId, difficulty); else onCampaign(difficulty); }}
        >
          {mode === 'single' ? 'Gather the Party →' : 'Begin the Campaign →'}
        </button>
      </div>
    </div>
  );
}
