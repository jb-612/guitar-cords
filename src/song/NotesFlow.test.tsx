import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { NotesSheet } from './NotesSheet';
import { STANDARD_TUNING } from '../music/chordShape';

type User = ReturnType<typeof userEvent.setup>;

const lane = () => within(screen.getByRole('listitem', { name: 'Bar 1' })).queryAllByTestId(/^bar-(hit|rest|notes)$/).map((el) => el.dataset.symbol ?? '-');
const fret = (dialog: HTMLElement, label: RegExp) => within(dialog).getByRole('textbox', { name: label });

async function openNotes(user: User) {
  await user.click(screen.getByRole('button', { name: /^add chord$/i }));
  await user.click(within(screen.getByRole('dialog', { name: /add a chord/i })).getByRole('button', { name: /add notes/i }));
  return screen.getByRole('dialog', { name: /add notes/i });
}

async function enter(user: User, dialog: HTMLElement, frets: [RegExp, string][], length: string) {
  for (const [label, value] of frets) await user.type(fret(dialog, label), value);
  await user.click(within(within(dialog).getByRole('radiogroup', { name: 'Length' })).getByRole('radio', { name: length }));
  await user.click(within(dialog).getByRole('button', { name: /^add$/i }));
}

beforeEach(() => localStorage.clear());

describe('NotesSheet', () => {
  it('shows the note name for each fretted string and refuses frets off the neck', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<NotesSheet title="Add notes" tuning={STANDARD_TUNING} onSave={onSave} onClose={() => {}} />);
    const dialog = screen.getByTestId('notes-sheet');
    await user.type(fret(dialog, /string 6/i), '3');
    expect(within(dialog).getByText('G')).toBeInTheDocument();
    await user.type(fret(dialog, /string 1/i), '99');
    expect(fret(dialog, /string 1/i)).toHaveValue('9');
    await user.click(within(dialog).getByRole('button', { name: /^add$/i }));
    expect(onSave).toHaveBeenCalledWith([{ string: 0, fret: 3 }, { string: 5, fret: 9 }], null);
  });

  it('cannot add without a note', () => {
    render(<NotesSheet title="Add notes" tuning={STANDARD_TUNING} onSave={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
  });
});

describe('riffs and bass lines in a song', () => {
  it('adds notes from the picker, then edits, duplicates and deletes them', async () => {
    const user = userEvent.setup();
    render(<App />);
    await enter(user, await openNotes(user), [[/string 6/i, '3']], 'Quarter');
    expect(lane()).toEqual(['♪ 3', '-']);
    expect(screen.getByTestId('bar-notes')).toHaveAccessibleName(/notes: string 6 fret 3, quarter/i);

    await user.click(screen.getByTestId('bar-notes'));
    let sheet = screen.getByRole('dialog', { name: /edit notes/i });
    await user.clear(fret(sheet, /string 6/i));
    await user.type(fret(sheet, /string 5/i), '2');
    await user.click(within(sheet).getByRole('button', { name: /^save$/i }));
    expect(lane()).toEqual(['♪ 2', '-']);

    await user.click(screen.getByTestId('bar-notes'));
    sheet = screen.getByRole('dialog', { name: /edit notes/i });
    await user.click(within(sheet).getByRole('button', { name: /duplicate/i }));
    expect(lane()).toEqual(['♪ 2', '♪ 2', '-']);

    await user.click(screen.getAllByTestId('bar-notes')[0]!);
    await user.click(within(screen.getByRole('dialog', { name: /edit notes/i })).getByRole('button', { name: /delete notes/i }));
    expect(lane()).toEqual(['-', '♪ 2', '-']);
  });

  it('fills a rest with notes after a chord', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^add chord$/i }));
    const picker = screen.getByRole('dialog', { name: /add a chord/i });
    await user.click(within(within(picker).getByRole('radiogroup', { name: 'Length' })).getByRole('radio', { name: 'Half' }));
    await user.click(within(within(picker).getByRole('group', { name: 'Common chords' })).getByRole('button', { name: 'G' }));
    await user.click(screen.getByTestId('bar-rest'));
    await user.click(within(screen.getByRole('dialog', { name: /add a chord/i })).getByRole('button', { name: /add notes/i }));
    await enter(user, screen.getByRole('dialog', { name: /add notes/i }), [[/string 4/i, '0'], [/string 3/i, '2']], 'Fill');
    expect(lane()).toEqual(['G', '♪ 0·2']);
  });
});
