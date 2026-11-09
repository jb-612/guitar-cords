import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

type User = ReturnType<typeof userEvent.setup>;

const symbols = () => screen.queryAllByTestId('bar-hit').map((el) => el.dataset.symbol);

async function song(user: User, chords: string[], key: string) {
  for (const c of chords) {
    await user.click(screen.getByRole('button', { name: /^add chord$/i }));
    const picker = screen.getByRole('dialog', { name: /add a chord/i });
    await user.click(within(within(picker).getByRole('group', { name: 'Common chords' })).getByRole('button', { name: c }));
  }
  await user.selectOptions(screen.getByLabelText('Song key'), key);
}

async function openTranspose(user: User) {
  await user.click(screen.getByRole('button', { name: 'Transpose' }));
  return screen.getByRole('dialog', { name: 'Transpose & key' });
}

beforeEach(() => localStorage.clear());

describe('transpose & change key', () => {
  it('moves the song up in half steps with new chord shapes, previewing the result', async () => {
    const user = userEvent.setup();
    render(<App />);
    await song(user, ['G', 'C', 'D', 'Em'], 'G');
    const sheet = await openTranspose(user);
    await user.click(within(sheet).getByRole('button', { name: 'Up a half step' }));
    await user.click(within(sheet).getByRole('button', { name: 'Up a half step' }));
    expect(within(sheet).getByTestId('transpose-preview')).toHaveTextContent('A D E F#m');
    await user.click(within(sheet).getByRole('button', { name: 'Apply' }));
    expect(symbols()).toEqual(['A', 'D', 'E', 'F#m']);
    expect(screen.getByLabelText('Song key')).toHaveValue('A');
  });

  it('changes to a chosen key', async () => {
    const user = userEvent.setup();
    render(<App />);
    await song(user, ['G', 'C', 'D', 'Em'], 'G');
    const sheet = await openTranspose(user);
    await user.selectOptions(within(sheet).getByRole('combobox', { name: 'New key' }), 'E');
    await user.click(within(sheet).getByRole('button', { name: 'Apply' }));
    expect(symbols()).toEqual(['E', 'A', 'B', 'C#m']);
  });

  it('can keep the same shapes and use a capo instead', async () => {
    const user = userEvent.setup();
    render(<App />);
    await song(user, ['G', 'C', 'D', 'Em'], 'G');
    const sheet = await openTranspose(user);
    await user.click(within(sheet).getByRole('button', { name: 'Up a half step' }));
    await user.click(within(sheet).getByRole('button', { name: 'Up a half step' }));
    await user.click(within(sheet).getByRole('radio', { name: /same shapes \+ capo 2/i }));
    await user.click(within(sheet).getByRole('button', { name: 'Apply' }));
    expect(symbols()).toEqual(['G', 'C', 'D', 'Em']);
    expect(screen.getByRole('combobox', { name: 'Capo' })).toHaveValue('2');
    expect(screen.getByText(/sounds in A major/i)).toBeInTheDocument();
  });

  it('suggests easier shapes with a capo for the key the song sounds in', async () => {
    const user = userEvent.setup();
    render(<App />);
    await song(user, ['A', 'D', 'E'], 'A');
    const sheet = await openTranspose(user);
    await user.click(within(sheet).getByRole('button', { name: /G shapes, capo 2/i }));
    expect(symbols()).toEqual(['G', 'C', 'D']);
    expect(screen.getByRole('combobox', { name: 'Capo' })).toHaveValue('2');
  });

  it('sets the capo directly from the song settings', async () => {
    const user = userEvent.setup();
    render(<App />);
    await song(user, ['G'], 'G');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Capo' }), '3');
    expect(screen.getByText(/sounds in Bb major/i)).toBeInTheDocument();
    expect(symbols()).toEqual(['G']);
  });

  it('can be undone in one step', async () => {
    const user = userEvent.setup();
    render(<App />);
    await song(user, ['G', 'C'], 'G');
    const sheet = await openTranspose(user);
    await user.click(within(sheet).getByRole('button', { name: 'Up a half step' }));
    await user.click(within(sheet).getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(symbols()).toEqual(['G', 'C']);
  });
});
