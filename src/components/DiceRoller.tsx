import { useEffect, useRef, useState } from 'react';
import type { CheckResult } from '../types';
import { prefersReducedMotion } from '../ui/visuals';
import { sfx } from '../ui/sfx';

interface Props {
  heroName: string;
  skillLabel: string;
  result: CheckResult;
  onContinue: () => void;
}

type Phase = 'rolling' | 'settled';

export function DiceRoller({ heroName, skillLabel, result, onContinue }: Props) {
  const { roll, modifier, total, dc, success, crit } = result;
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduced ? 'settled' : 'rolling');
  const [shown, setShown] = useState<number>(reduced ? roll : 1);
  const dieRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (reduced) return;

    sfx.diceRoll();
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Number cycle that visibly decelerates (like a slowing wheel).
    // Stops the moment the die settles so it locks onto the true roll.
    let delay = 55;
    const tick = () => {
      if (doneRef.current) return;
      setShown(1 + Math.floor(Math.random() * 20));
      delay += 9;
      timers.push(setTimeout(tick, delay));
    };
    timers.push(setTimeout(tick, delay));

    // Land on the real value, then play the payoff.
    timers.push(setTimeout(() => {
      doneRef.current = true;
      setShown(roll);
      setPhase('settled');
      if (crit === 'success') { sfx.crit(); spawnSparks(); }
      else if (crit === 'fail') { sfx.fumble(); stageRef.current?.classList.add('shake'); }
    }, 820));

    return () => { doneRef.current = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function spawnSparks() {
    const die = dieRef.current;
    if (!die) return;
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * 70;
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      die.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
  }

  const dieClass = [
    'die',
    phase === 'rolling' ? 'rolling' : 'settle',
    phase === 'settled' && crit === 'success' ? 'crit' : '',
    phase === 'settled' && crit === 'fail' ? 'fumble' : '',
  ].filter(Boolean).join(' ');

  const sign = modifier >= 0 ? '+' : '';
  const outcomeText = crit === 'success' ? 'CRITICAL SUCCESS!'
    : crit === 'fail' ? 'CRITICAL FAILURE!'
    : success ? 'Success' : 'Failure';
  const outcomeColor = success ? 'var(--green)' : 'var(--accent-bright)';

  return (
    <div className="panel panel--framed center" style={{ maxWidth: 440, margin: '20px auto' }}>
      <p className="muted" style={{ marginTop: 0 }}>
        {heroName} attempts a <span className="engraved">{skillLabel}</span> check
      </p>

      <div className="dice-stage" ref={stageRef}>
        <div className={dieClass} ref={dieRef} aria-label={`d20 rolled ${shown}`}>
          {shown}
        </div>
      </div>

      {phase === 'settled' ? (
        <div className="outcome-block">
          <p style={{ fontSize: '1.15rem' }}>
            {roll} {sign}{modifier} = <strong>{total}</strong> vs <strong>DC {dc}</strong>
          </p>
          <p className="outcome reveal" style={{ color: outcomeColor }}>{outcomeText}</p>
          <button className="btn btn-primary reveal" onClick={() => { sfx.click(); onContinue(); }}>
            Continue
          </button>
        </div>
      ) : (
        <p className="faint" style={{ height: 88, display: 'grid', placeItems: 'center', margin: 0 }}>
          The die tumbles…
        </p>
      )}
    </div>
  );
}
