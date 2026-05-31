import { sfx } from '../ui/sfx';

interface Props {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

// A handful of drifting embers rising from the hearth.
const EMBERS = Array.from({ length: 14 }, (_, i) => i);

export function TavernHome({ hasSave, onNewGame, onContinue }: Props) {
  return (
    <div className="app-shell screen center" style={{ paddingTop: '11vh', position: 'relative' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {EMBERS.map((i) => (
          <span
            key={i}
            className="ember"
            style={{
              left: `${(i * 7 + 5) % 100}%`,
              ['--drift' as string]: `${(i % 5) * 12 - 24}px`,
              animationDuration: `${7 + (i % 6)}s`,
              animationDelay: `${(i % 7) * 1.1}s`,
            }}
          />
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: '2.6rem', letterSpacing: '0.4em', marginBottom: 4 }}>🍺&nbsp;🔥</div>
        <h1 className="title-xl">Tavern</h1>
        <div className="scene-rule" style={{ maxWidth: 280, margin: '14px auto' }} />
        <p className="subtitle" style={{ maxWidth: 540, margin: '0 auto 30px', fontSize: '1.15rem' }}>
          Gather your party by the hearth, share a drink, and let the dice decide your fate.
          The tale of the&nbsp;<span className="engraved" style={{ fontStyle: 'normal' }}>Hollow Bell of Brackenmoor</span>&nbsp;awaits.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ fontSize: '1.05rem', padding: '14px 28px' }} onClick={() => { sfx.click(); onNewGame(); }}>
            New Game
          </button>
          {hasSave && (
            <button className="btn" style={{ padding: '14px 24px' }} onClick={() => { sfx.click(); onContinue(); }}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
