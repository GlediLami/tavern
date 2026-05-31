import { useEffect } from 'react';
import { getAdventure } from '../engine/party';
import { getScene } from '../engine/story';
import { sfx } from '../ui/sfx';

interface Props {
  sceneId: string;
  onReturn: () => void;
}

export function EndingScreen({ sceneId, onReturn }: Props) {
  const scene = getScene(getAdventure(), sceneId);
  const victory = scene.type === 'ending' && scene.endingType === 'victory';

  useEffect(() => {
    if (scene.type !== 'ending') return;
    if (victory) sfx.victory(); else sfx.defeat();
  }, [scene.type, victory]);

  if (scene.type !== 'ending') return null;

  return (
    <div className="app-shell screen center" style={{ paddingTop: '8vh' }}>
      <div style={{ fontSize: '3.4rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))' }}>
        {victory ? '🏆' : '💀'}
      </div>
      <h1
        className="title-xl"
        style={victory ? undefined : {
          background: 'linear-gradient(180deg, #e0726a, var(--blood) 55%, #5a1717)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        }}
      >
        {scene.title}
      </h1>
      <p
        className="engraved"
        style={{ textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 700, color: victory ? 'var(--gold-bright)' : 'var(--blood-bright)', marginTop: 4 }}
      >
        {scene.endingType}
      </p>
      <div className="scene-rule" style={{ maxWidth: 320, margin: '14px auto' }} />
      <p className="subtitle" style={{ maxWidth: 580, margin: '0 auto 32px', fontStyle: 'normal', lineHeight: 1.75, fontSize: '1.15rem' }}>
        {scene.narration}
      </p>
      <button className="btn btn-primary" style={{ fontSize: '1.02rem', padding: '13px 26px' }} onClick={() => { sfx.click(); onReturn(); }}>
        Return to the Tavern
      </button>
    </div>
  );
}
