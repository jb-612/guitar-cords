import { ChordThumb } from '../components/ChordThumb';
import { SheetHeader } from '../components/Sheet';
import type { SongChord } from './song';

interface Props {
  chord: SongChord;
  beatsPerBar: number;
  onEdit: () => void;
  onLength: (beats: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Options for a chord tapped in a bar: edit its shape, change its length, delete it. */
export function ChordActions({ chord, beatsPerBar, onEdit, onLength, onDelete, onClose }: Props) {
  const isFull = chord.beats >= beatsPerBar;
  return (
    <div className="chord-actions">
      <SheetHeader title={`${chord.symbol} chord`} onClose={onClose} />
      <div className="chord-actions-preview">
        <ChordThumb shape={chord.shape} />
      </div>
      <div className="chord-actions-list">
        <button type="button" className="btn ghost" onClick={onEdit}>
          Edit shape
        </button>
        <button type="button" className="btn ghost" onClick={() => onLength(isFull ? beatsPerBar / 2 : beatsPerBar)}>
          {isFull ? 'Half bar' : 'Full bar'}
        </button>
        <button type="button" className="btn ghost danger" onClick={onDelete}>
          Delete chord
        </button>
      </div>
    </div>
  );
}
