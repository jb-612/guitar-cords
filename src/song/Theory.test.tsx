import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

type User = ReturnType<typeof userEvent.setup>;

async function chords(user: User, list: string[]) {
  for (const c of list) {
    await user.click(screen.getByRole('button', { name: /^add chord$/i }));
    const picker = screen.getByRole('dialog', { name: /add a chord/i });
    await user.click(within(within(picker).getByRole('group', { name: 'Common chords' })).getByRole('button', { name: c }));
  }
}

beforeEach(() => localStorage.clear());

describe('theory helpers', () => {
  it('says how sure the key suggestion is, and the runner-up', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chords(user, ['G', 'C', 'D', 'G']);
    const pill = screen.getByRole('status');
    expect(pill).toHaveTextContent(/G major/);
    expect(pill).toHaveTextContent(/100% sure/);
    expect(pill).toHaveTextContent(/or E minor/);
  });

  it('switches between the major key and its relative minor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chords(user, ['G']);
    await user.selectOptions(screen.getByLabelText('Song key'), 'G');
    await user.click(screen.getByRole('button', { name: 'Relative key: E minor' }));
    expect(screen.getByLabelText('Song key')).toHaveValue('Em');
    await user.click(screen.getByRole('button', { name: 'Relative key: G major' }));
    expect(screen.getByLabelText('Song key')).toHaveValue('G');
  });

  it('shows Roman numerals for the chords in the song key', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chords(user, ['G', 'C', 'D', 'Em']);
    await user.selectOptions(screen.getByLabelText('Song key'), 'G');
    await user.click(screen.getByRole('button', { name: 'Numerals' }));
    expect(screen.getAllByTestId('numeral').map((n) => n.textContent)).toEqual(['I', 'IV', 'V', 'vi']);
  });

  it('names chords in an alternate tuning, and keeps the standard-tuning library out of the way', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tuning' }), 'drop-d');
    await user.click(screen.getByRole('button', { name: /^add chord$/i }));
    const picker = screen.getByRole('dialog', { name: /add a chord/i });
    expect(within(picker).getByText(/library shapes are for standard tuning/i)).toBeInTheDocument();
    expect(within(picker).queryByRole('group', { name: 'Common chords' })).toBeNull();
    await user.click(within(picker).getByRole('button', { name: /create a new chord/i }));
    const editor = screen.getByRole('dialog', { name: /new chord/i });
    for (const [s, f] of [[3, 2], [2, 3], [1, 2]] as const) await user.click(within(editor).getByRole('button', { name: `String ${s}, fret ${f}` }));
    expect(within(editor).getByTestId('chord-name')).toHaveAccessibleName('D');
  });
});
