import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { EngineFactoryContext } from './engine';
import { fakeEngineFactory, type FakeEngine } from '../test/fakeEngine';
import { addChord, createSong, setLyrics, type Song } from '../song/song';
import { shapeFromFrets } from '../music/chordShape';

const STORAGE_KEY = 'guitar-cords:current-song';

function seedSong(): Song {
  let s = createSong({ title: 'Practice' });
  s = addChord(s, { symbol: 'G', shape: shapeFromFrets('320003') });
  s = addChord(s, { symbol: 'C', shape: shapeFromFrets('x32010') });
  s = addChord(s, { symbol: 'D', shape: shapeFromFrets('xx0232') });
  s = setLyrics(s, s.bars[1]!.id, 'second bar words');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  return s;
}

function setup() {
  const { factory, engines } = fakeEngineFactory();
  const user = userEvent.setup();
  render(
    <EngineFactoryContext.Provider value={factory}>
      <App />
    </EngineFactoryContext.Provider>,
  );
  const engine = () => engines[0] as FakeEngine;
  return { user, engines, engine };
}

const bar = (n: number) => screen.getByRole('listitem', { name: `Bar ${n}` });

beforeEach(() => {
  localStorage.clear();
  seedSong();
});

describe('song player', () => {
  it('does not load the engine until it is needed', () => {
    const { engines } = setup();
    expect(engines).toHaveLength(0);
  });

  it('loads the song and plays on Play, then shows Pause while playing', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(engine().last('load')).toContain('\\title "Practice"');
    expect(engine().count('playPause')).toBe(1);
    engine().emit({ type: 'state', playing: true });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('stops', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(engine().count('stop')).toBe(1);
  });

  it('slows the tempo down and shows the resulting bpm', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '50' } });
    expect(engine().last('setSpeed')).toBe(0.5);
    expect(screen.getByText('45 bpm')).toBeInTheDocument();
  });

  it('applies tempo, loop and metronome chosen before the engine existed', async () => {
    const { user, engine } = setup();
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '75' } });
    await user.click(screen.getByRole('button', { name: 'Loop' }));
    await user.click(screen.getByRole('button', { name: 'Metronome' }));
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(engine().last('setSpeed')).toBe(0.75);
    expect(engine().last('setLooping')).toBe(true);
    expect(engine().last('setMetronome')).toBe(true);
  });

  it('toggles loop and metronome', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    const loop = screen.getByRole('button', { name: 'Loop' });
    await user.click(loop);
    expect(loop).toHaveAttribute('aria-pressed', 'true');
    expect(engine().last('setLooping')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Metronome' }));
    expect(engine().last('setMetronome')).toBe(true);
  });

  it('loops a chosen section of bars', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    await user.click(screen.getByRole('button', { name: /loop section/i }));
    await user.click(screen.getByRole('button', { name: 'Select bar 2' }));
    await user.click(screen.getByRole('button', { name: 'Select bar 3' }));
    expect(engine().last('setRange')).toEqual({ from: 1, to: 2 });
    expect(engine().last('setLooping')).toBe(true);
    expect(screen.getByText('Bars 2–3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear section/i }));
    expect(engine().last('setRange')).toBeNull();
  });

  it('follows playback: highlights the bar and shows the chord with its fingers', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    engine().emit({ type: 'position', bar: 1, unit: 0 });
    expect(bar(2)).toHaveAttribute('aria-current', 'true');
    const now = screen.getByRole('region', { name: 'Now playing' });
    expect(within(now).getByTestId('now-chord')).toHaveAccessibleName('C');
    expect(within(now).getByTestId('now-diagram')).toBeInTheDocument();
    expect(within(now).getByText('second bar words')).toBeInTheDocument();
    expect(within(now).getByTestId('next-chord')).toHaveAccessibleName('D');
  });

  it('while strumming the same chord, Next shows the next different chord', async () => {
    let s = createSong({ title: 'Strums' });
    for (const units of [8, 8, 8, 8]) s = addChord(s, { symbol: 'G', shape: shapeFromFrets('320003') }, units);
    s = addChord(s, { symbol: 'C', shape: shapeFromFrets('x32010') });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    engine().emit({ type: 'position', bar: 0, unit: 16 });
    const now = screen.getByRole('region', { name: 'Now playing' });
    expect(within(now).getByTestId('now-chord')).toHaveAccessibleName('G');
    expect(within(now).getByTestId('next-chord')).toHaveAccessibleName('C');
  });

  it('practice mode hides finger positions and keeps chord names', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    engine().emit({ type: 'position', bar: 0, unit: 0 });
    await user.click(screen.getByRole('button', { name: 'Hide fingers' }));
    const now = screen.getByRole('region', { name: 'Now playing' });
    expect(within(now).queryByTestId('now-diagram')).toBeNull();
    expect(within(now).getByTestId('now-chord')).toHaveAccessibleName('G');
  });

  it('switches to tab and score views', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('radio', { name: 'Tab' }));
    expect(engine().last('setView')).toBe('tab');
    expect(screen.getByTestId('score-host')).not.toHaveClass('is-hidden');
    await user.click(screen.getByRole('radio', { name: 'Score' }));
    expect(engine().last('setView')).toBe('score');
    await user.click(screen.getByRole('radio', { name: 'Chords' }));
    expect(screen.getByTestId('score-host')).toHaveClass('is-hidden');
  });

  it('reloads the engine when the song changes', async () => {
    const { user, engine } = setup();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    const loads = engine().count('load');
    await user.type(screen.getByRole('textbox', { name: 'Lyrics for bar 1' }), 'x');
    expect(engine().count('load')).toBeGreaterThan(loads);
  });
});
