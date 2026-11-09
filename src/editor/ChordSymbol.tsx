/**
 * Engraved chord-chart typography: large root, raised quality, slash bass,
 * with real ♯/♭ glyphs. The accessible name stays the plain symbol ("F#m7/C#").
 */
interface Props {
  symbol?: string;
  inline?: boolean;
}

const accidentals = (s: string) => s.replace(/#/g, '♯').replace(/(?<=[A-G])b/g, '♭');

function split(symbol: string) {
  const [main = '', bass] = symbol.split('/');
  const root = /^[A-G][#b]?/.exec(main)?.[0] ?? '';
  return { root, quality: main.slice(root.length), bass };
}

export function ChordSymbol({ symbol = '', inline = false }: Props) {
  if (inline) return <span className="chord-symbol inline">{accidentals(symbol)}</span>;
  return symbol ? <EngravedSymbol symbol={symbol} /> : <UnknownSymbol />;
}

function UnknownSymbol() {
  return (
    <h2 className="chord-symbol is-unknown" data-testid="chord-name" aria-label="Unknown chord">
      ?
    </h2>
  );
}

function EngravedSymbol({ symbol }: { symbol: string }) {
  const { root, quality, bass } = split(symbol);
  return (
    <h2 key={symbol} className="chord-symbol" data-testid="chord-name" aria-label={symbol}>
      <span className="cs-root" aria-hidden="true">{accidentals(root)}</span>
      {quality && <span className="cs-quality" aria-hidden="true">{accidentals(quality)}</span>}
      {bass && <span className="cs-bass" aria-hidden="true">/{accidentals(bass)}</span>}
    </h2>
  );
}
