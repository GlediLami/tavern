interface Props { onClose: () => void; }

const SECTIONS: { title: string; body: string }[] = [
  { title: 'Skill checks', body: 'When an action is uncertain, a hero rolls a d20 and adds their ability modifier (plus their proficiency bonus if trained) versus a Difficulty Class (DC). Meet or beat the DC to succeed. A natural 20 is a critical success; a natural 1 a critical failure.' },
  { title: 'Advantage & disadvantage', body: 'Advantage (⬆) rolls two d20s and keeps the higher; disadvantage (⬇) keeps the lower. They cancel out. Powers, relics, cover, and enemy abilities can grant either.' },
  { title: 'Combat', body: "Everyone rolls initiative for turn order. An attack rolls a d20 + to-hit versus the target's Armor Class (AC); a hit rolls the weapon's damage dice. A natural 20 doubles the damage dice." },
  { title: 'Saving throws', body: "Some spells let the target resist instead of being attacked — e.g. Sacred Flame forces a Dexterity save: the foe rolls a d20 + their save versus the caster's save DC, taking damage only if they fail." },
  { title: 'Powers, items & relics', body: 'Each class has one signature power with limited uses. Potions and other items can be used as a combat action. Relics drafted at rests and level-ups grant passive bonuses for the rest of the run.' },
];

export function HelpOverlay({ onClose }: Props) {
  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="How to play" onClick={onClose}>
      <div className="panel panel--framed help-card" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ margin: 0 }}>How to Play</h2>
          <button className="btn" aria-label="Close help" onClick={onClose}>✕ Close</button>
        </div>
        <div className="scene-rule" />
        <div className="stack" style={{ gap: 14 }}>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="accent-text" style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>{s.title}</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
