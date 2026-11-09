/**
 * Performance mode: a full-screen stage view for playing live. Huge current chord (with its
 * fingers unless hidden), the next chord, the lyric line; tap anywhere to play/pause.
 */
import { useEffect } from 'react';
import { ChordThumb } from '../components/ChordThumb';
import { ChordSymbol } from '../editor/ChordSymbol';
import type { ChordHit, Song } from '../song/song';
import { chordsAt } from './NowPlaying';
import type { Player } from './usePlayer';
import './PerformanceView.css';

export function PerformanceView({ song, player, onExit }: { song: Song; player: Player; onExit: () => void }) {
  const position = player.position ?? { bar: 0, unit: 0 };
  const { current, next } = chordsAt(song, position);
  useEscape(onExit);
  return (
    <div className="stage" role="dialog" aria-modal="true" aria-label="Performance">
      <button type="button" className="stage-tap" aria-label="Play or pause" onClick={player.playPause} />
      <StageTop song={song} bar={position.bar} onExit={onExit} />
      <div className="stage-main">
        <StageChord chord={current} showFingers={!player.settings.hideFingers} />
        <p className="stage-lyrics">{song.bars[position.bar]?.lyrics}</p>
      </div>
      <div className="stage-next">
        <NextUp chord={next} />
        <span className="stage-state">{player.playing ? 'Playing — tap to pause' : 'Tap anywhere to play'}</span>
      </div>
    </div>
  );
}

function useEscape(onExit: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);
}

function StageTop({ song, bar, onExit }: { song: Song; bar: number; onExit: () => void }) {
  const section = song.bars[bar]?.section;
  return (
    <div className="stage-top">
      <span className="stage-title">{song.title}</span>
      <span className="stage-bar">
        Bar {bar + 1} / {song.bars.length}
        {section ? ` · ${section}` : ''}
      </span>
      <button type="button" className="stage-exit" onClick={onExit}>
        Exit
      </button>
    </div>
  );
}

function StageChord({ chord, showFingers }: { chord?: ChordHit; showFingers: boolean }) {
  if (!chord) return <div className="stage-chord" data-testid="stage-chord" aria-label="" />;
  return (
    <>
      <div className="stage-chord" data-testid="stage-chord" aria-label={chord.symbol} key={chord.id}>
        <ChordSymbol symbol={chord.symbol} inline />
      </div>
      {showFingers && (
        <div className="stage-diagram" key={`d-${chord.id}`}>
          <ChordThumb shape={chord.shape} />
        </div>
      )}
    </>
  );
}

function NextUp({ chord }: { chord?: ChordHit }) {
  if (!chord) return <span />;
  return (
    <span>
      Next{' '}
      <span data-testid="stage-next" aria-label={chord.symbol}>
        <ChordSymbol symbol={chord.symbol} inline />
      </span>
    </span>
  );
}
