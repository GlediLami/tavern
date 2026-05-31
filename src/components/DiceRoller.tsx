import type { CheckResult } from '../types';

interface Props {
  heroName: string;
  skillLabel: string;
  result: CheckResult;
  onContinue: () => void;
}

export function DiceRoller({ heroName, skillLabel, result, onContinue }: Props) {
  const { roll, modifier, total, dc, success, crit } = result;
  const sign = modifier >= 0 ? '+' : '';
  const outcome = crit === 'success' ? 'CRITICAL SUCCESS!'
    : crit === 'fail' ? 'CRITICAL FAILURE!'
    : success ? 'Success' : 'Failure';
  const color = success ? 'var(--green)' : 'var(--blood)';

  return (
    <div className="panel center" style={{ maxWidth: 420, margin: '20px auto' }}>
      <p className="muted">{heroName} attempts a {skillLabel} check</p>
      <div
        style={{
          fontSize: '3.4rem', fontWeight: 800, color: 'var(--gold-bright)',
          width: 110, height: 110, lineHeight: '110px', margin: '8px auto',
          border: '3px solid var(--gold)', borderRadius: 18,
          background: 'radial-gradient(circle at 35% 30%, #3a2c1e, #1c150e)',
        }}
        aria-label={`d20 rolled ${roll}`}
      >
        {roll}
      </div>
      <p style={{ fontSize: '1.1rem' }}>
        {roll} {sign}{modifier} = <strong>{total}</strong> vs <strong>DC {dc}</strong>
      </p>
      <p style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{outcome}</p>
      <button className="btn btn-primary" onClick={onContinue}>Continue</button>
    </div>
  );
}
