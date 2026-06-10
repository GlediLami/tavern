import { useState } from 'react';
import { getAllCharacters } from '../engine/party';
import { abilityMod } from '../engine/skills';
import { sfx } from '../ui/sfx';
import type { Ability } from '../types';

const MAX_PARTY = 4;
const ABILS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

interface Props {
  onConfirm: (partyIds: string[], playerNames: Record<string, string>) => void;
}

export function PartySelect({ onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const characters = getAllCharacters();

  function toggle(id: string) {
    sfx.click();
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PARTY) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="app-shell screen">
      <h2 className="engraved" style={{ fontSize: '1.9rem', marginBottom: 2 }}>Who Gathers at the Table?</h2>
      <div className="scene-rule" style={{ maxWidth: 360 }} />
      <p className="muted">Choose up to {MAX_PARTY} heroes — each player takes one to command.</p>

      <div className="grid-cards stagger">
        {characters.map((c) => {
          const isSel = selected.includes(c.id);
          return (
            <button
              key={c.id}
              className={`panel panel--framed hero-card${isSel ? ' selected' : ''}`}
              onClick={() => toggle(c.id)}
            >
              <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                <span className="portrait">{c.portrait}</span>
                <div>
                  <h3 className="display" style={{ margin: 0, fontSize: '1.18rem' }}>{c.name}</h3>
                  <div className="faint" style={{ fontSize: '0.9rem' }}>{c.race} · {c.class}</div>
                </div>
              </div>

              <div className="row" style={{ gap: 6, margin: '12px 0 8px' }}>
                {ABILS.map((a) => (
                  <span key={a} className="stat-pill">
                    {a.toUpperCase()} {abilityMod(c.abilities[a]) >= 0 ? '+' : ''}{abilityMod(c.abilities[a])}
                  </span>
                ))}
              </div>
              <div className="row" style={{ gap: 8, fontSize: '0.9rem' }}>
                <span className="stat-pill" style={{ color: 'var(--green)' }}>♥ {c.maxHp} HP</span>
                <span className="stat-pill" style={{ color: 'var(--blue)' }}>⛊ AC {c.ac}</span>
              </div>

              <p className="muted" style={{ fontSize: '0.92rem', marginBottom: isSel ? 6 : 0 }}>{c.backstory}</p>
              {isSel && <div className="accent-text" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>✓ In the Party</div>}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="panel" style={{ marginTop: 18, padding: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Name Your Players (optional)</h3>
          <div className="stack">
            {selected.map((id) => {
              const c = getAllCharacters().find((ch) => ch.id === id)!;
              return (
                <div key={id} className="row" style={{ alignItems: 'center', gap: 10 }}>
                  <span className="portrait" style={{ width: 30, height: 30, fontSize: '1rem' }}>{c.portrait}</span>
                  <span style={{ minWidth: 150 }}>{c.name}</span>
                  <input
                    className="name-input"
                    aria-label={`Player name for ${c.name}`}
                    placeholder="Player name"
                    value={names[id] ?? ''}
                    onChange={(e) => setNames((n) => ({ ...n, [id]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 22, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: '1.02rem', padding: '13px 26px' }}
          disabled={selected.length === 0}
          onClick={() => {
            sfx.click();
            const playerNames: Record<string, string> = {};
            for (const id of selected) { const v = names[id]?.trim(); if (v) playerNames[id] = v; }
            onConfirm(selected, playerNames);
          }}
        >
          Enter the Tavern ({selected.length}/{MAX_PARTY})
        </button>
      </div>
    </div>
  );
}
