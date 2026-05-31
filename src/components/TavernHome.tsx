import { sfx } from '../ui/sfx';

interface Props {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

const SPARKS = Array.from({ length: 14 }, (_, i) => i);

export function TavernHome({ hasSave, onNewGame, onContinue }: Props) {
  return (
    <div
      className="app-shell screen center"
      style={{
        paddingTop: '12vh',
        position: 'relative',
        // a touch brighter, with a soft overhead glow
        background: 'radial-gradient(60% 50% at 50% 8%, rgba(108,140,213,0.14), transparent 60%)',
        borderRadius: 24,
      }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {SPARKS.map((i) => (
          <span
            key={i}
            className="ember"
            style={{
              left: `${(i * 7 + 5) % 100}%`,
              ['--drift' as string]: `${(i % 5) * 12 - 24}px`,
              animationDuration: `${8 + (i % 6)}s`,
              animationDelay: `${(i % 7) * 1.1}s`,
            }}
          />
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: '2.2rem', letterSpacing: '0.5em', marginBottom: 10, opacity: 0.9 }}>⚔&nbsp;🎲&nbsp;🛡️</div>
        <h1 className="title-xl">Tavern</h1>
        <div className="rule-accent" style={{ margin: '18px auto', maxWidth: 200 }} />
        <p className="subtitle" style={{ maxWidth: 560, margin: '0 auto 32px', fontSize: '1.12rem', lineHeight: 1.7 }}>
          Gather a party, choose your tale, and let the dice decide your fate.
          A pass-and-play adventure of choices, skill checks, and battle.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ fontSize: '1.05rem', padding: '14px 30px' }} onClick={() => { sfx.click(); onNewGame(); }}>
            New Game
          </button>
          {hasSave && (
            <button className="btn" style={{ padding: '14px 26px' }} onClick={() => { sfx.click(); onContinue(); }}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
