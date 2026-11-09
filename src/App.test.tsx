import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

const bars = () => screen.getAllByRole('listitem', { name: /^Bar \d+$/ });
const barChords = () => bars().map((b) => within(b).queryAllByTestId('bar-chord').map((c) => c.getAttribute('aria-label')));

async function addFromLibrary(user: ReturnType<typeof userEvent.setup>, symbol: string) {
  await user.click(screen.getByRole('button', { name: /add chord/i }));
  const dialog = screen.getByRole('dialog', { name: /add a chord/i });
  await user.click(within(within(dialog).getByRole('group', { name: 'Common chords' })).getByRole('button', { name: symbol }));
}

beforeEach(() => localStorage.clear());

describe('App song flow', () => {
  it('starts with an empty song and an add-chord button', () => {
    render(<App />);
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue('Untitled song');
    expect(screen.getByRole('button', { name: /add chord/i })).toBeInTheDocument();
  });

  it('adds chords from the library one after another', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G');
    await addFromLibrary(user, 'C');
    expect(barChords()).toEqual([['G'], ['C']]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('creates a new chord in the editor and adds it to the song', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /add chord/i }));
    await user.click(screen.getByRole('button', { name: /create a new chord/i }));
    const editor = screen.getByRole('dialog', { name: /new chord/i });
    await user.click(within(editor).getByRole('button', { name: 'Mute string 6' }));
    await user.click(within(editor).getByRole('button', { name: 'String 5, fret 3' }));
    await user.click(within(editor).getByRole('button', { name: 'String 4, fret 2' }));
    await user.click(within(editor).getByRole('button', { name: 'String 2, fret 1' }));
    await user.click(within(editor).getByRole('button', { name: /save chord/i }));
    expect(barChords()).toEqual([['C']]);
  });

  it('suggests a key after a few chords and lets the creator accept it', async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const c of ['G', 'C', 'D', 'G']) await addFromLibrary(user, c);
    await user.click(screen.getByRole('button', { name: /use key g major/i }));
    expect(screen.getByLabelText('Song key')).toHaveValue('G');
  });

  it('edits a chord in a bar: half bar, then delete', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G');
    await addFromLibrary(user, 'C');
    await user.click(within(bars()[0]!).getByTestId('bar-chord'));
    await user.click(screen.getByRole('button', { name: /half bar/i }));
    await user.click(within(bars()[1]!).getByTestId('bar-chord'));
    await user.click(screen.getByRole('button', { name: /delete chord/i }));
    expect(barChords()).toEqual([['G']]);
  });

  it('types lyrics under a bar and keeps them after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await addFromLibrary(user, 'G');
    await user.type(screen.getByRole('textbox', { name: 'Lyrics for bar 1' }), 'Hello');
    unmount();
    render(<App />);
    expect(screen.getByRole('textbox', { name: 'Lyrics for bar 1' })).toHaveValue('Hello');
  });
});
