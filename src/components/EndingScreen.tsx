import { useEffect } from 'react';
import { getAdventure } from '../engine/party';
import { getScene } from '../engine/story';
import { sfx } from '../ui/sfx';

interface Props {
  adventureId: string;
  sceneId: string;
  onReturn: () => void;
}

export function EndingScreen({ adventureId, sceneId, onReturn }: Props) {
  const scene = getScene(getAdventure(adventureId), sceneId);
  const victory = scene.type === 'ending' && scene.endingType === 'victory';

  useEffect(() => {
    if (scene.type !== 'ending') return;
    if (victory) sfx.victory(); else sfx.defeat();
  }, [scene.type, victory]);

  if (scene.type !== 'ending') return null;

  return (
    <div className="app-shell screen center" style={{ paddingTop: '9vh' }}>
      <div style={{ fontSize: '3.4rem', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))' }}>
        {victory ? '🏆' : '💀'}
      </div>
      <h1 className="title-xl" style={{ color: victory ? 'var(--gold)' : 'var(--accent-bright)', textShadow: victory ? '0 2px 22px rgba(217,164,65,0.3)' : '0 2px 22px rgba(230,59,80,0.3)' }}>
        {scene.title}
      </h1>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.35em', fontWeight: 700, color: victory ? 'var(--gold)' : 'var(--accent-bright)', marginTop: 6 }}>
        {scene.endingType}
      </p>
      <div className="rule-accent" style={{ maxWidth: 240, margin: '16px auto', background: victory ? 'linear-gradient(90deg, transparent, var(--gold), transparent)' : 'linear-gradient(90deg, transparent, var(--accent-bright), transparent)' }} />
      <p className="subtitle" style={{ maxWidth: 600, margin: '0 auto 34px', lineHeight: 1.8, fontSize: '1.12rem' }}>
        {scene.narration}
      </p>
      <button className="btn btn-primary" style={{ fontSize: '1.02rem', padding: '13px 28px' }} onClick={() => { sfx.click(); onReturn(); }}>
        Return to the Tavern
      </button>
    </div>
  );
}
