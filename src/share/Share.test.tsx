import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { addChord, createSong, setLyrics } from '../song/song';
import { shapeFromFrets } from '../music/chordShape';
import { exportSongFile } from './convert';
import { songToLink } from './link';

type User = ReturnType<typeof userEvent.setup>;

function aSong() {
  let s = createSong({ title: 'Shared tune' });
  s = addChord(s, { symbol: 'G', shape: shapeFromFrets('320003') });
  return setLyrics(s, s.bars[0]!.id, 'la la la');
}

async function openShare(user: User) {
  await user.click(screen.getByRole('button', { name: 'Share' }));
  return screen.getByRole('dialog', { name: 'Share & export' });
}

let downloads: string[] = [];

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  downloads = [];
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('share & export', () => {
  it.each([
    ['Guitar Pro (.gp)', 'Untitled song.gp'],
    ['MusicXML', 'Untitled song.musicxml'],
    ['MIDI', 'Untitled song.mid'],
    ['Song file (.json)', 'Untitled song.guitarcords.json'],
  ])('exports %s', async (label, file) => {
    const user = userEvent.setup();
    render(<App />);
    const sheet = await openShare(user);
    await user.click(within(sheet).getByRole('button', { name: label }));
    await waitFor(() => expect(downloads).toEqual([file]));
  });

  it('copies a share link', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<App />);
    const sheet = await openShare(user);
    await user.click(within(sheet).getByRole('button', { name: 'Copy share link' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#song='));
    expect(await within(sheet).findByText(/link copied/i)).toBeInTheDocument();
  });

  it('opening a share link adds the song to My songs and opens it', () => {
    window.location.hash = new URL(songToLink(aSong(), 'https://x.test/')).hash;
    render(<App />);
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue('Shared tune');
    expect(screen.getByRole('status')).toHaveTextContent(/added “Shared tune”/i);
    expect(window.location.hash).toBe('');
  });

  it('imports a file as a new song', async () => {
    const user = userEvent.setup();
    render(<App />);
    const sheet = await openShare(user);
    const file = new File([exportSongFile(aSong())], 'shared.guitarcords.json', { type: 'application/json' });
    await user.upload(within(sheet).getByLabelText('Import a file'), file);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue('Shared tune'));
  });

  it('shows an error for files it cannot open', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);
    const sheet = await openShare(user);
    await user.upload(within(sheet).getByLabelText('Import a file'), new File(['hello'], 'notes.txt'));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(/can't open/i);
  });

  it('prints a chord sheet with diagrams, chords and lyrics', async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    window.print = print;
    localStorage.setItem('guitar-cords:library', JSON.stringify({ currentId: aSong().id, songs: [aSong()] }));
    render(<App />);
    const sheet = await openShare(user);
    await user.click(within(sheet).getByRole('button', { name: /print chord sheet/i }));
    expect(print).toHaveBeenCalled();
    const printed = screen.getByTestId('print-sheet');
    expect(within(printed).getByText('Shared tune')).toBeInTheDocument();
    expect(within(printed).getByText('la la la')).toBeInTheDocument();
  });
});
