import { useState } from 'react';
import { getAllCharacters } from '../engine/party';
import { abilityMod } from '../engine/skills';
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
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PARTY) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="app-shell">
      <h2 style={{ color: 'var(--gold-bright)' }}>Who gathers at the table?</h2>
      <p className="muted">Choose up to {MAX_PARTY} heroes. Each player will control one.</p>
      <div className="grid-cards">
        {characters.map((c) => {
          const isSel = selected.includes(c.id);
          return (
            <button
              key={c.id}
              className="panel"
              onClick={() => toggle(c.id)}
              style={{
                textAlign: 'left', cursor: 'pointer',
                borderColor: isSel ? 'var(--gold)' : 'var(--border)',
                boxShadow: isSel ? '0 0 0 2px var(--gold) inset' : 'var(--shadow)',
              }}
            >
              <div style={{ fontSize: '2rem' }}>{c.portrait}</div>
              <h3 style={{ margin: '4px 0' }}>{c.name}</h3>
              <div className="muted">{c.race} {c.class}</div>
              <div className="row" style={{ gap: 8, margin: '8px 0', fontSize: '0.8rem' }}>
                {ABILS.map((a) => (
                  <span key={a} title={a}>
                    {a.toUpperCase()} {c.abilities[a]} ({abilityMod(c.abilities[a]) >= 0 ? '+' : ''}{abilityMod(c.abilities[a])})
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.85rem' }}>HP {c.maxHp} · AC {c.ac}</div>
              <p className="muted" style={{ fontSize: '0.82rem' }}>{c.backstory}</p>
              {isSel && <div style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>✓ In Party</div>}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
          Enter the Tavern ({selected.length}/{MAX_PARTY})
        </button>
      </div>
    </div>
  );
}
