import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { App } from './App';

type User = ReturnType<typeof userEvent.setup>;

/** Run axe on the whole page. Colour contrast can't be measured in jsdom (no layout/paint). */
async function violations() {
  const result = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

async function withSong(user: User) {
  for (const c of ['G', 'C']) {
    await user.click(screen.getByRole('button', { name: /^add chord$/i }));
    const picker = screen.getByRole('dialog', { name: /add a chord/i });
    await user.click(within(within(picker).getByRole('group', { name: 'Common chords' })).getByRole('button', { name: c }));
  }
}

beforeEach(() => localStorage.clear());

describe('accessibility (axe)', () => {
  const open: [string, (user: User) => Promise<void>][] = [
    ['song screen', async () => {}],
    ['chord picker', async (u) => u.click(screen.getByRole('button', { name: /^add chord$/i }))],
    ['chord editor', async (u) => {
      await u.click(screen.getByRole('button', { name: /^add chord$/i }));
      await u.click(screen.getByRole('button', { name: /create a new chord/i }));
    }],
    ['chord options', async (u) => u.click(screen.getAllByTestId('bar-hit')[0]!)],
    ['bar menu', async (u) => u.click(screen.getByRole('button', { name: 'Bar 1 options' }))],
    ['my songs', async (u) => u.click(screen.getByRole('button', { name: 'My songs' }))],
    ['account', async (u) => u.click(screen.getByRole('button', { name: 'Account' }))],
    ['share', async (u) => u.click(screen.getByRole('button', { name: 'Share' }))],
    ['transpose', async (u) => u.click(screen.getByRole('button', { name: 'Transpose' }))],
    ['sound & practice', async (u) => u.click(screen.getByRole('button', { name: 'Sound & practice' }))],
    ['settings', async (u) => u.click(screen.getByRole('button', { name: 'Settings' }))],
    ['new song', async (u) => u.click(screen.getByRole('button', { name: 'New song' }))],
    ['performance', async (u) => u.click(screen.getByRole('button', { name: 'Perform' }))],
  ];

  it.each(open)('%s has no violations', async (_, show) => {
    const user = userEvent.setup();
    render(<App />);
    await withSong(user);
    await show(user);
    expect(await violations()).toEqual([]);
  });

  it('first-run walkthrough has no violations', async () => {
    localStorage.removeItem('guitar-cords:tour-seen');
    render(<App />);
    expect(await violations()).toEqual([]);
  });
});

describe('keyboard focus in sheets', () => {
  it('moves focus into a sheet, keeps Tab inside it, and returns focus when it closes', async () => {
    const user = userEvent.setup();
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Settings' });
    await user.click(opener);
    const sheet = screen.getByRole('dialog', { name: 'Settings' });
    expect(sheet.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(opener).toHaveFocus();
  });
});
