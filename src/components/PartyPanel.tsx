import { useState } from 'react';
import { getCharacter } from '../engine/party';
import { effectiveMaxHp } from '../engine/difficulty';
import { abilityMod } from '../engine/skills';
import { getPower } from '../engine/powers';
import { hpColor } from '../ui/visuals';
import type { Ability, Difficulty } from '../types';

const ABILS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

interface Props {
  partyIds: string[];
  hp: Record<string, number>;
  difficulty: Difficulty;
  level?: number;
}

export function PartyPanel({ partyIds, hp, difficulty, level = 1 }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="stack">
      {partyIds.map((id) => {
        const c = getCharacter(id);
        const max = Math.max(1, effectiveMaxHp(c, difficulty, level));
        const current = hp[id] ?? max;
        const ratio = current / max;
        const pct = Math.max(0, Math.min(100, ratio * 100));
        const down = current <= 0;
        const isOpen = !!open[id];
        const power = c.powerId ? getPower(c.powerId) : null;
        const attacksLine = c.attacks
          .map((a) => `${a.name} ${a.damageDice}${a.damageBonus ? `+${a.damageBonus}` : ''}${a.save ? ` (${a.save.toUpperCase()} save)` : ''}`)
          .join(' · ');
        return (
          <div key={id} className="panel" style={{ padding: 13, opacity: down ? 0.5 : 1 }}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, width: '100%', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
            >
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className="row" style={{ alignItems: 'center', gap: 8 }}>
                  <span className="portrait" style={{ width: 34, height: 34, fontSize: '1.2rem' }}>{c.portrait}</span>
                  <strong style={{ fontWeight: 600 }}>{c.name}</strong>
                </span>
                <span className="row" style={{ alignItems: 'center', gap: 6 }}>
                  <span className="faint" style={{ fontSize: '0.78rem' }}>{c.class}</span>
                  <span className="faint" aria-hidden style={{ fontSize: '0.7rem' }}>{isOpen ? '▾' : '▸'}</span>
                </span>
              </div>
            </button>
            <div className="hp-bar" style={{ marginTop: 9 }} role="progressbar" aria-label={`${c.name} hit points`} aria-valuenow={Math.max(0, current)} aria-valuemin={0} aria-valuemax={max}>
              <div className="hp-fill" style={{ width: `${pct}%`, background: hpColor(ratio) }} />
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
              {down
                ? <span style={{ color: 'var(--accent-bright)', fontWeight: 700, letterSpacing: '0.08em' }}>✟ DOWN</span>
                : <span className="muted">{current} / {max}</span>}
            </div>
            {isOpen && (
              <div className="stack" style={{ marginTop: 10, gap: 6 }}>
                <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                  {ABILS.map((a) => (
                    <span key={a} className="stat-pill" style={{ fontSize: '0.72rem' }}>
                      {a.toUpperCase()} {abilityMod(c.abilities[a]) >= 0 ? '+' : ''}{abilityMod(c.abilities[a])}
                    </span>
                  ))}
                  <span className="stat-pill" style={{ fontSize: '0.72rem', color: 'var(--blue)' }}>AC {c.ac}</span>
                </div>
                <div className="faint" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>{attacksLine}</div>
                {power && <div className="accent-text" style={{ fontSize: '0.8rem' }}>✦ {power.name}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
