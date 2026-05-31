interface Props {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
}

export function TavernHome({ hasSave, onNewGame, onContinue }: Props) {
  return (
    <div className="app-shell center" style={{ paddingTop: '12vh' }}>
      <div style={{ fontSize: '3rem' }}>🍺🔥</div>
      <h1 className="title-xl">Tavern</h1>
      <p className="subtitle" style={{ maxWidth: 520, margin: '8px auto 28px' }}>
        Gather your party by the hearth, share a drink, and let the dice decide your fate.
        A tale of the Hollow Bell of Brackenmoor awaits.
      </p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onNewGame}>New Game</button>
        {hasSave && (
          <button className="btn" onClick={onContinue}>Continue</button>
        )}
      </div>
    </div>
  );
}
