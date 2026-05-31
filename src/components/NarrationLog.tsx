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
    <div className="panel" style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
      {entries.map((e, i) => (
        <p key={i} className="muted" style={{ margin: '4px 0', fontSize: '0.9rem' }}>{e}</p>
      ))}
      <div ref={endRef} />
    </div>
  );
}
