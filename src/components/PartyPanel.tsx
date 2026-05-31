import { getCharacter } from '../engine/party';

interface Props {
  partyIds: string[];
  hp: Record<string, number>;
}

export function PartyPanel({ partyIds, hp }: Props) {
  return (
    <div className="stack">
      {partyIds.map((id) => {
        const c = getCharacter(id);
        const current = hp[id] ?? c.maxHp;
        const pct = Math.max(0, Math.min(100, (current / c.maxHp) * 100));
        const down = current <= 0;
        return (
          <div key={id} className="panel" style={{ padding: 12, opacity: down ? 0.55 : 1 }}>
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span><span style={{ fontSize: '1.3rem' }}>{c.portrait}</span> <strong>{c.name}</strong></span>
              <span className="muted" style={{ fontSize: '0.8rem' }}>{c.class}</span>
            </div>
            <div className="hp-bar" style={{ marginTop: 8 }}>
              <div className="hp-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
              {down ? <span style={{ color: 'var(--blood)', fontWeight: 700 }}>DOWN</span> : `${current} / ${c.maxHp}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
