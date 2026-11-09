import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

type User = ReturnType<typeof userEvent.setup>;

async function openSettings(user: User) {
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  return screen.getByRole('dialog', { name: 'Settings' });
}

const skipTour = async (user: User) => {
  const tour = screen.queryByRole('dialog', { name: 'Welcome to Guitar Cords' });
  if (tour) await user.click(within(tour).getByRole('button', { name: 'Skip' }));
};

beforeEach(() => {
  localStorage.clear();
  localStorage.removeItem('guitar-cords:tour-seen');
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.chordView;
});

describe('settings', () => {
  it('switches between system, light and dark themes and remembers the choice', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await skipTour(user);
    const sheet = await openSettings(user);
    await user.click(within(sheet).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(within(sheet).getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    unmount();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(within(await openSettings(user)).getByRole('radio', { name: 'System' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('makes the chord view compact or large, and remembers it', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await skipTour(user);
    const sheet = await openSettings(user);
    expect(within(sheet).getByRole('radio', { name: 'Normal' })).toBeChecked();
    await user.click(within(sheet).getByRole('radio', { name: 'Compact' }));
    expect(document.documentElement.dataset.chordView).toBe('compact');
    unmount();
    render(<App />);
    expect(document.documentElement.dataset.chordView).toBe('compact');
    await user.click(within(await openSettings(user)).getByRole('radio', { name: 'Large' }));
    expect(document.documentElement.dataset.chordView).toBe('large');
    await user.click(within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('radio', { name: 'Normal' }));
    expect(document.documentElement.dataset.chordView).toBeUndefined();
  });

  it('left-handed mode mirrors chord diagrams', async () => {
    const user = userEvent.setup();
    render(<App />);
    await skipTour(user);
    const sheet = await openSettings(user);
    await user.click(within(sheet).getByRole('checkbox', { name: /left-handed/i }));
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /^add chord$/i }));
    await user.click(screen.getByRole('button', { name: /create a new chord/i }));
    expect(screen.getByRole('application')).toHaveClass('is-lefty');
  });
});

describe('first-run walkthrough', () => {
  it('greets a first-time creator, steps through the tips, and does not come back after closing', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const tour = screen.getByRole('dialog', { name: 'Welcome to Guitar Cords' });
    expect(within(tour).getByText(/tap a string/i)).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: 'Next' }));
    expect(within(tour).getByText(/hold a finger/i)).toBeInTheDocument();
    await user.click(within(tour).getByRole('button', { name: 'Skip' }));
    unmount();
    render(<App />);
    expect(screen.queryByRole('dialog', { name: 'Welcome to Guitar Cords' })).toBeNull();
  });

  it('can be shown again from Settings', async () => {
    const user = userEvent.setup();
    render(<App />);
    await skipTour(user);
    await user.click(within(await openSettings(user)).getByRole('button', { name: /show the tips again/i }));
    expect(screen.getByRole('dialog', { name: 'Welcome to Guitar Cords' })).toBeInTheDocument();
  });
});
