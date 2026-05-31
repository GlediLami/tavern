import { useEffect, useRef } from 'react';

interface Props {
  entries: string[];
}

export function NarrationLog({ entries }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0) return null;
  return (
    <div className="panel" style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 18, padding: '14px 18px' }}>
      <div className="faint" style={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
        Chronicle
      </div>
      {entries.map((e, i) => (
        <p key={i} className="muted" style={{ margin: '4px 0', fontSize: '0.94rem', fontStyle: 'italic' }}>{e}</p>
      ))}
      <div ref={endRef} />
    </div>
  );
}
