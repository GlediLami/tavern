import { getCharacter } from '../engine/party';
import { effectiveMaxHp } from '../engine/difficulty';
import { hpColor } from '../ui/visuals';
import type { Difficulty } from '../types';

interface Props {
  partyIds: string[];
  hp: Record<string, number>;
  difficulty: Difficulty;
}

export function PartyPanel({ partyIds, hp, difficulty }: Props) {
  return (
    <div className="stack">
      {partyIds.map((id) => {
        const c = getCharacter(id);
        const max = effectiveMaxHp(c, difficulty);
        const current = hp[id] ?? max;
        const ratio = current / max;
        const pct = Math.max(0, Math.min(100, ratio * 100));
        const down = current <= 0;
        return (
          <div key={id} className="panel" style={{ padding: 13, opacity: down ? 0.5 : 1 }}>
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span className="row" style={{ alignItems: 'center', gap: 8 }}>
                <span className="portrait" style={{ width: 34, height: 34, fontSize: '1.2rem' }}>{c.portrait}</span>
                <strong style={{ fontWeight: 600 }}>{c.name}</strong>
              </span>
              <span className="faint" style={{ fontSize: '0.78rem' }}>{c.class}</span>
            </div>
            <div className="hp-bar" style={{ marginTop: 9 }}>
              <div className="hp-fill" style={{ width: `${pct}%`, background: hpColor(ratio) }} />
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
              {down
                ? <span style={{ color: 'var(--accent-bright)', fontWeight: 700, letterSpacing: '0.08em' }}>✟ DOWN</span>
                : <span className="muted">{current} / {max}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
