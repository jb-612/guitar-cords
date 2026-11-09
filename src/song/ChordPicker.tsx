/**
 * Visual chord library: chords in the song key, common open chords, and search
 * by name (showing every stored fingering). "Create a new chord" opens the editor.
 */
import { useState } from 'react';
import { ChordThumb } from '../components/ChordThumb';
import { SheetHeader } from '../components/Sheet';
import { toFretString } from '../music/chordShape';
import { parseChord } from '../music/chordSymbol';
import { diatonicChords } from '../music/diatonic';
import { VOICING_LIBRARY, suggestVoicings, type Voicing } from '../music/voicings';
import { ChordSymbol } from '../editor/ChordSymbol';
import type { ChordChoice } from './song';
import './ChordPicker.css';

interface Props {
  songKey: string | null;
  /** The creator's own fingerings, newest first. */
  myChords?: ChordChoice[];
  onPick: (choice: ChordChoice) => void;
  onCreate: () => void;
  onClose: () => void;
}

const COMMON = Object.keys(VOICING_LIBRARY);

type Item = { symbol: string; voicing: Voicing };

const asItem = (c: ChordChoice): Item => ({ symbol: c.symbol, voicing: { frets: toFretString(c.shape), shape: c.shape, label: 'My chord' } });

const matching = (mine: ChordChoice[], query: string) =>
  mine.filter((c) => c.symbol.toLowerCase().includes(query.toLowerCase())).map(asItem);

/** First fingering for each symbol that has one. */
const withShapes = (symbols: string[]) =>
  symbols.flatMap((symbol) => {
    const v = suggestVoicings(symbol)[0];
    return v ? [{ symbol, voicing: v }] : [];
  });

export function ChordPicker({ songKey, myChords = [], onPick, onCreate, onClose }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  return (
    <div className="picker">
      <SheetHeader title="Add a chord" onClose={onClose} />
      <div className="picker-search">
        <input
          type="search"
          aria-label="Find a chord"
          placeholder="Find a chord — e.g. F#m7"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {q ? <SearchResults query={q} mine={matching(myChords, q)} onPick={onPick} onCreate={onCreate} /> : <Library songKey={songKey} mine={myChords.map(asItem)} onPick={onPick} />}
      <div className="picker-footer">
        <button type="button" className="btn ghost create-btn" onClick={onCreate}>
          <span aria-hidden="true">＋</span> Create a new chord
        </button>
      </div>
    </div>
  );
}

function Library({ songKey, mine, onPick }: { songKey: string | null; mine: Item[]; onPick: (c: ChordChoice) => void }) {
  return (
    <>
      {mine.length > 0 && <ChordGroup label="My chords" items={mine} onPick={onPick} />}
      {songKey && <ChordGroup label={`In the key of ${songKey}`} items={withShapes(diatonicChords(songKey))} onPick={onPick} featured />}
      <ChordGroup label="Common chords" items={withShapes(COMMON)} onPick={onPick} />
    </>
  );
}

interface SearchProps {
  query: string;
  mine: Item[];
  onPick: (c: ChordChoice) => void;
  onCreate: () => void;
}

function SearchResults({ query, mine, onPick, onCreate }: SearchProps) {
  return (
    <>
      {mine.length > 0 && <ChordGroup label="My chords" items={mine} onPick={onPick} />}
      <StandardResults query={query} quiet={mine.length > 0} onPick={onPick} onCreate={onCreate} />
    </>
  );
}

/** Fingerings for a standard chord name. `quiet` hides the "not found" message when own chords matched. */
function StandardResults({ query, quiet, onPick, onCreate }: Omit<SearchProps, 'mine'> & { quiet: boolean }) {
  const parsed = parseChord(query);
  if (!parsed && quiet) return null;
  if (!parsed) return <p className="picker-empty">No chord called “{query}”. Check the spelling, or create it on the fretboard.</p>;
  const voicings = suggestVoicings(query);
  if (voicings.length === 0) {
    return (
      <p className="picker-empty">
        No stored fingering for {query} yet.{' '}
        <button type="button" className="link-btn" onClick={onCreate}>
          Create it
        </button>
      </p>
    );
  }
  return <ChordGroup label={`${query} fingerings`} items={voicings.map((voicing) => ({ symbol: query, voicing }))} onPick={onPick} showLabel />;
}

interface GroupProps {
  label: string;
  items: Item[];
  onPick: (c: ChordChoice) => void;
  featured?: boolean;
  showLabel?: boolean;
}

function ChordGroup({ label, items, onPick, featured = false, showLabel = false }: GroupProps) {
  return (
    <section className={`picker-group${featured ? ' is-featured' : ''}`}>
      <h3 className="section-label">{label}</h3>
      <div className="picker-grid" role="group" aria-label={label}>
        {items.map(({ symbol, voicing }, i) => (
          <button
            key={`${symbol}-${voicing.frets}`}
            type="button"
            className="picker-tile"
            aria-label={symbol}
            style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
            onClick={() => onPick({ symbol, shape: voicing.shape })}
          >
            <ChordThumb shape={voicing.shape} />
            <ChordSymbol symbol={symbol} inline />
            {showLabel && <span className="tile-note">{voicing.label}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
