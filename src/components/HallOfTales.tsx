import { useState } from 'react';
import { ADVENTURES } from '../content/adventures';
import { loadChronicle, endingsOf, clearChronicle } from '../state/chronicle';
import { sfx } from '../ui/sfx';

export function HallOfTales({ onBack }: { onBack: () => void }) {
  const [tick, setTick] = useState(0);
  const chron = loadChronicle();
  void tick;

  return (
    <div className="app-shell screen">
      <h2 className="display" style={{ fontSize: '2rem', marginBottom: 2 }}>Hall of Tales</h2>
      <div className="rule-accent" />
      <p className="muted">Every ending you have uncovered across your adventures.</p>

      {chron.campaignWon && (
        <div className="panel panel--framed" style={{ marginBottom: 14 }}>
          <strong className="accent-text">🏆 Campaign complete — you have conquered all four tales.</strong>
        </div>
      )}

      <div className="stack">
        {ADVENTURES.map((a) => {
          const all = endingsOf(a.id);
          const found = chron.endings[a.id] ?? [];
          return (
            <div key={a.id} className="panel">
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.6rem' }}>{a.emoji}</span>
                  <strong className="display" style={{ fontSize: '1.15rem' }}>{a.title}</strong>
                </span>
                <span className="tag">{found.length}/{all.length} endings</span>
              </div>
              <div className="stack" style={{ gap: 4, marginTop: 10 }}>
                {all.map((e) => {
                  const got = found.includes(e.id);
                  return (
                    <div key={e.id} style={{ fontSize: '0.92rem', color: got ? 'var(--ink)' : 'var(--ink-faint)' }}>
                      {got ? `✓ ${e.title}` : '— ???'}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 22, justifyContent: 'space-between' }}>
        <button className="btn" onClick={() => { sfx.click(); clearChronicle(); setTick((t) => t + 1); }}>Clear records</button>
        <button className="btn btn-primary" onClick={() => { sfx.click(); onBack(); }}>← Back to the Tavern</button>
      </div>
    </div>
  );
}
