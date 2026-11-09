/** Share & export: share link, export (Guitar Pro, MusicXML, MIDI, song file), print / PDF, import. */
import { useState, type ChangeEvent } from 'react';
import { SheetHeader } from '../components/Sheet';
import type { Song } from '../song/song';
import { download, fileName } from './download';
import { songToLink } from './link';
import '../song/HitSheet.css';

interface Props {
  song: Song;
  onImported: (song: Song) => void;
  onPrint: () => void;
  onClose: () => void;
}

/** alphaTab is large: the converters load only when an export or import is used. */
const converters = () => import('./convert');

type Exporter = { label: string; ext: string; type: string; make: (c: Awaited<ReturnType<typeof converters>>, s: Song) => Uint8Array | string };

const EXPORTS: Exporter[] = [
  { label: 'Guitar Pro (.gp)', ext: 'gp', type: 'application/octet-stream', make: (c, s) => c.exportGuitarPro(s) },
  { label: 'MusicXML', ext: 'musicxml', type: 'application/vnd.recordare.musicxml+xml', make: (c, s) => c.exportMusicXml(s) },
  { label: 'MIDI', ext: 'mid', type: 'audio/midi', make: (c, s) => c.exportMidi(s) },
  { label: 'Song file (.json)', ext: 'guitarcords.json', type: 'application/json', make: (c, s) => c.exportSongFile(s) },
];

const IMPORT_TYPES = '.gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl,.json';

export function ShareSheet({ song, onImported, onPrint, onClose }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copyLink = async () => {
    await navigator.clipboard?.writeText(songToLink(song));
    setNotice('Link copied — anyone who opens it gets a copy of this song.');
  };

  const exportAs = async (x: Exporter) => {
    const c = await converters();
    download(`${fileName(song.title)}.${x.ext}`, x.make(c, song), x.type);
  };

  const importFrom = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const { importFile } = await converters();
      onImported(importFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="share">
      <SheetHeader title="Share & export" onClose={onClose} />
      <section className="hit-section">
        <span className="section-label">Share</span>
        <div className="chip-row">
          <button type="button" className="btn primary" onClick={() => void copyLink()}>
            Copy share link
          </button>
          <button type="button" className="btn ghost" onClick={onPrint}>
            Print chord sheet / Save as PDF
          </button>
        </div>
        {notice && <p className="share-notice">{notice}</p>}
      </section>
      <section className="hit-section">
        <span className="section-label">Export</span>
        <div className="chip-row">
          {EXPORTS.map((x) => (
            <button key={x.ext} type="button" className="chip-toggle" onClick={() => void exportAs(x)}>
              {x.label}
            </button>
          ))}
        </div>
      </section>
      <section className="hit-section">
        <label className="section-label" htmlFor="import-file">
          Import a file
        </label>
        <input id="import-file" type="file" accept={IMPORT_TYPES} onChange={(e) => void importFrom(e)} />
        <p className="share-hint">Guitar Pro (.gp, .gp3–.gp5, .gpx), MusicXML (.xml, .musicxml, .mxl) or a song file. It opens as a new song.</p>
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
