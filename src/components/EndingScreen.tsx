import { getAdventure } from '../engine/party';
import { getScene } from '../engine/story';

interface Props {
  sceneId: string;
  onReturn: () => void;
}

export function EndingScreen({ sceneId, onReturn }: Props) {
  const scene = getScene(getAdventure(), sceneId);
  if (scene.type !== 'ending') return null;
  const victory = scene.endingType === 'victory';

  return (
    <div className="app-shell center" style={{ paddingTop: '8vh' }}>
      <div style={{ fontSize: '3rem' }}>{victory ? '🏆' : '💀'}</div>
      <h1 className="title-xl" style={{ color: victory ? 'var(--gold-bright)' : 'var(--blood)' }}>
        {scene.title}
      </h1>
      <p style={{ textTransform: 'uppercase', letterSpacing: 2, color: victory ? 'var(--green)' : 'var(--blood)', fontWeight: 700 }}>
        {scene.endingType}
      </p>
      <p className="subtitle" style={{ maxWidth: 560, margin: '12px auto 28px', fontStyle: 'normal', lineHeight: 1.7 }}>
        {scene.narration}
      </p>
      <button className="btn btn-primary" onClick={onReturn}>Return to the Tavern</button>
    </div>
  );
}
