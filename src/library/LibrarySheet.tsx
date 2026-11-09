/** "My songs": every song in the library — open, rename, duplicate, delete (with confirmation). */
import { useState, type KeyboardEvent } from 'react';
import { SheetHeader } from '../components/Sheet';
import type { Song } from '../song/song';
import './LibrarySheet.css';

interface Props {
  songs: Song[];
  currentId: string;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", or a date. */
const AGES: [limit: number, label: (age: number) => string][] = [
  [MINUTE, () => 'just now'],
  [HOUR, (age) => `${Math.floor(age / MINUTE)} min ago`],
  [DAY, (age) => `${Math.floor(age / HOUR)} h ago`],
];

export function timeAgo(at: number | undefined, now = Date.now()): string {
  if (!at) return '';
  const age = now - at;
  const match = AGES.find(([limit]) => age < limit);
  return match ? match[1](age) : new Date(at).toLocaleDateString();
}

const meta = (s: Song) => [`${s.bars.length} ${s.bars.length === 1 ? 'bar' : 'bars'}`, s.key ?? 'no key', timeAgo(s.updatedAt)].filter(Boolean).join(' · ');

export function LibrarySheet(props: Props) {
  return (
    <div className="library">
      <SheetHeader title="My songs" onClose={props.onClose} />
      <ul className="song-list">
        {props.songs.map((s) => (
          <SongRow key={s.id} song={s} current={s.id === props.currentId} {...props} />
        ))}
      </ul>
      <div className="hit-actions">
        <button type="button" className="btn primary" onClick={props.onNew}>
          ＋ New song
        </button>
      </div>
    </div>
  );
}

type Mode = 'view' | 'rename' | 'confirm-delete';

function SongRow({ song, current, onOpen, onRename, onDuplicate, onDelete }: Props & { song: Song; current: boolean }) {
  const [mode, setMode] = useState<Mode>('view');
  return (
    <li className={`song-row${current ? ' is-current' : ''}`} aria-label={song.title} aria-current={current ? 'true' : undefined}>
      {mode === 'rename' ? (
        <RenameField title={song.title} onDone={(t) => (t !== null && onRename(song.id, t), setMode('view'))} />
      ) : (
        <button type="button" className="song-open" aria-label={`Open ${song.title}`} onClick={() => onOpen(song.id)}>
          <span className="song-name">{song.title}</span>
          <span className="song-meta">{meta(song)}</span>
        </button>
      )}
      {mode === 'confirm-delete' ? (
        <ConfirmDelete title={song.title} onYes={() => onDelete(song.id)} onNo={() => setMode('view')} />
      ) : (
        <div className="song-actions">
          <button type="button" className="chip-toggle" onClick={() => setMode('rename')}>
            Rename
          </button>
          <button type="button" className="chip-toggle" onClick={() => onDuplicate(song.id)}>
            Duplicate
          </button>
          <button type="button" className="chip-toggle danger" onClick={() => setMode('confirm-delete')}>
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

/** Inline rename: Enter or leaving the field saves, Escape cancels (null). */
function RenameField({ title, onDone }: { title: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(title);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') onDone(value);
    if (e.key === 'Escape') onDone(null);
  };
  return (
    <input
      className="text-input song-rename"
      aria-label={`New name for ${title}`}
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onDone(value)}
    />
  );
}

function ConfirmDelete({ title, onYes, onNo }: { title: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="song-confirm" role="alert">
      <span>Delete “{title}”? This can't be undone.</span>
      <button type="button" className="chip-toggle danger-solid" onClick={onYes}>
        Yes, delete
      </button>
      <button type="button" className="chip-toggle" onClick={onNo}>
        Keep
      </button>
    </div>
  );
}
