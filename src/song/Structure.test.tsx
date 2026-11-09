import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

type User = ReturnType<typeof userEvent.setup>;

const bars = () => screen.getAllByRole('listitem', { name: /^Bar \d+$/ });
const bar = (n: number) => screen.getByRole('listitem', { name: `Bar ${n}` });
const order = () => bars().map((b) => within(b).queryAllByTestId('bar-hit')[0]?.dataset.symbol ?? '-');

async function chords(user: User, list: string[]) {
  for (const c of list) {
    await user.click(screen.getByRole('button', { name: /^add chord$/i }));
    const picker = screen.getByRole('dialog', { name: /add a chord/i });
    await user.click(within(within(picker).getByRole('group', { name: 'Common chords' })).getByRole('button', { name: c }));
  }
}

async function barMenu(user: User, n: number) {
  await user.click(within(bar(n)).getByRole('button', { name: `Bar ${n} options` }));
  return screen.getByRole('dialog', { name: `Bar ${n}` });
}

beforeEach(() => localStorage.clear());

describe('sections, repeats and endings', () => {
  it('labels a bar as the start of a section', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chords(user, ['G', 'C']);
    const menu = await barMenu(user, 2);
    await user.click(within(menu).getByRole('button', { name: 'Chorus' }));
    await user.click(within(menu).getByRole('button', { name: 'Close' }));
    expect(within(bar(2)).getByText('Chorus')).toBeInTheDocument();
  });

  it('adds repeat signs and a 1st ending', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chords(user, ['G', 'C', 'D']);
    let menu = await barMenu(user, 1);
    await user.click(within(menu).getByRole('checkbox', { name: /repeat starts here/i }));
    await user.click(within(menu).getByRole('button', { name: 'Close' }));
    menu = await barMenu(user, 2);
    await user.click(within(menu).getByRole('checkbox', { name: /repeat ends here/i }));
    await user.click(within(menu).getByRole('checkbox', { name: '1st ending' }));
    await user.click(within(menu).getByRole('button', { name: 'Close' }));
    expect(within(bar(1)).getByLabelText('Repeat start')).toBeInTheDocument();
    expect(within(bar(2)).getByLabelText('Repeat end, play 2 times')).toBeInTheDocument();
    expect(within(bar(2)).getByLabelText('1st ending')).toBeInTheDocument();
  });
});

describe('selecting, copying and pasting bars', () => {
  it('selects bars, copies them and pastes after another bar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chords(user, ['G', 'C', 'D']);
    const menu = await barMenu(user, 1);
    await user.click(within(menu).getByRole('button', { name: 'Select bars' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select bar 2' }));
    const actions = screen.getByRole('toolbar', { name: 'Selected bars' });
    expect(within(actions).getByText('2 bars selected')).toBeInTheDocument();
    await user.click(within(actions).getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select bar 1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select bar 2' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select bar 3' }));
    await user.click(within(actions).getByRole('button', { name: 'Paste after' }));
    expect(order()).toEqual(['G', 'C', 'D', 'G', 'C']);
  });

  it('shift-click on a bar header selects a range; Delete removes the selection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chords(user, ['G', 'C', 'D', 'E']);
    fireEvent.click(within(bar(2)).getByTestId('bar-head'), { shiftKey: true });
    fireEvent.click(within(bar(3)).getByTestId('bar-head'), { shiftKey: true });
    expect(screen.getByText('2 bars selected')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(order()).toEqual(['G', 'E']);
  });

  it('cut and paste between songs, with keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chords(user, ['G', 'C']);
    fireEvent.click(within(bar(2)).getByTestId('bar-head'), { metaKey: true });
    fireEvent.keyDown(window, { key: 'x', metaKey: true });
    expect(order()).toEqual(['G']);
    await user.click(screen.getByRole('button', { name: 'New song' }));
    await user.click(within(screen.getByRole('dialog', { name: 'New song' })).getByRole('button', { name: 'Create song' }));
    await user.click(screen.getByRole('button', { name: /paste 1 bar/i }));
    expect(order()).toEqual(['C']);
  });
});
