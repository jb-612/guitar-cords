import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

type User = ReturnType<typeof userEvent.setup>;

const title = () => screen.getByRole('textbox', { name: 'Song title' });
const hitCount = () => screen.queryAllByTestId('bar-hit').length;

async function newSong(user: User, name: string) {
  await user.click(screen.getByRole('button', { name: 'New song' }));
  const setup = screen.getByRole('dialog', { name: 'New song' });
  await user.clear(within(setup).getByRole('textbox', { name: 'Title' }));
  await user.type(within(setup).getByRole('textbox', { name: 'Title' }), name);
  await user.click(within(setup).getByRole('button', { name: 'Create song' }));
}

async function addG(user: User) {
  await user.click(screen.getByRole('button', { name: /^add chord$/i }));
  const picker = screen.getByRole('dialog', { name: /add a chord/i });
  await user.click(within(within(picker).getByRole('group', { name: 'Common chords' })).getByRole('button', { name: 'G' }));
}

async function openLibrary(user: User) {
  await user.click(screen.getByRole('button', { name: 'My songs' }));
  return screen.getByRole('dialog', { name: 'My songs' });
}

const row = (lib: HTMLElement, name: string) => within(lib).getByRole('listitem', { name });

beforeEach(() => localStorage.clear());

describe('song library', () => {
  it('a new song is added next to the old one instead of replacing it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.clear(title());
    await user.type(title(), 'First');
    await newSong(user, 'Second');
    expect(title()).toHaveValue('Second');
    const lib = await openLibrary(user);
    expect(within(lib).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual(['First', 'Second']);
  });

  it('opens a song from the list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addG(user);
    await newSong(user, 'Empty one');
    expect(hitCount()).toBe(0);
    const lib = await openLibrary(user);
    await user.click(within(row(lib, 'Untitled song')).getByRole('button', { name: 'Open Untitled song' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(hitCount()).toBe(1);
  });

  it('renames, duplicates and deletes (with confirmation)', async () => {
    const user = userEvent.setup();
    render(<App />);
    let lib = await openLibrary(user);
    await user.click(within(row(lib, 'Untitled song')).getByRole('button', { name: 'Rename' }));
    const input = within(lib).getByRole('textbox', { name: 'New name for Untitled song' });
    await user.clear(input);
    await user.type(input, 'Blackbird{Enter}');
    expect(row(lib, 'Blackbird')).toBeInTheDocument();
    await user.click(within(row(lib, 'Blackbird')).getByRole('button', { name: 'Duplicate' }));
    expect(row(lib, 'Blackbird (copy)')).toBeInTheDocument();
    await user.click(within(row(lib, 'Blackbird (copy)')).getByRole('button', { name: 'Delete' }));
    await user.click(within(row(lib, 'Blackbird (copy)')).getByRole('button', { name: 'Keep' }));
    expect(row(lib, 'Blackbird (copy)')).toBeInTheDocument();
    await user.click(within(row(lib, 'Blackbird (copy)')).getByRole('button', { name: 'Delete' }));
    await user.click(within(row(lib, 'Blackbird (copy)')).getByRole('button', { name: 'Yes, delete' }));
    lib = screen.getByRole('dialog', { name: 'My songs' });
    expect(within(lib).getAllByRole('listitem')).toHaveLength(1);
    expect(title()).toHaveValue('Blackbird');
  });

  it('keeps every song after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await newSong(user, 'Second');
    unmount();
    render(<App />);
    expect(title()).toHaveValue('Second');
    const lib = await openLibrary(user);
    expect(within(lib).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('undo and redo', () => {
  it('undoes and redoes song edits with the buttons', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addG(user);
    expect(hitCount()).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(hitCount()).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(hitCount()).toBe(1);
  });

  it('supports Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addG(user);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(hitCount()).toBe(0);
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });
    expect(hitCount()).toBe(1);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(hitCount()).toBe(0);
  });

  it('typing a title is one undo step', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.clear(title());
    await user.type(title(), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(title()).toHaveValue('Untitled song');
  });

  it('buttons are disabled when there is nothing to undo or redo', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });
});
