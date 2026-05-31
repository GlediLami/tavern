import { useState } from 'react';
import { getAllCharacters } from '../engine/party';
import { abilityMod } from '../engine/skills';
import { sfx } from '../ui/sfx';
import type { Ability } from '../types';

const MAX_PARTY = 4;
const ABILS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

interface Props {
  onConfirm: (partyIds: string[]) => void;
}

export function PartySelect({ onConfirm }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
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
                  <h3 className="engraved" style={{ margin: 0, fontSize: '1.15rem' }}>{c.name}</h3>
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
                <span className="stat-pill" style={{ color: 'var(--nature)' }}>♥ {c.maxHp} HP</span>
                <span className="stat-pill" style={{ color: 'var(--arcane)' }}>⛊ AC {c.ac}</span>
              </div>

              <p className="muted" style={{ fontSize: '0.92rem', marginBottom: isSel ? 6 : 0 }}>{c.backstory}</p>
              {isSel && <div className="engraved" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>✓ In the Party</div>}
            </button>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 22, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: '1.02rem', padding: '13px 26px' }}
          disabled={selected.length === 0}
          onClick={() => { sfx.click(); onConfirm(selected); }}
        >
          Enter the Tavern ({selected.length}/{MAX_PARTY})
        </button>
      </div>
    </div>
  );
}
