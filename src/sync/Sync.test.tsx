import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { offlineBackend, SyncContext } from './backend';
import { FakeCloud } from '../test/fakeSync';
import { createSong } from '../song/song';

type User = ReturnType<typeof userEvent.setup>;

function setup<B extends FakeCloud | typeof offlineBackend = FakeCloud>(cloud: B = new FakeCloud() as B) {
  const user = userEvent.setup();
  render(
    <SyncContext.Provider value={() => cloud}>
      <App />
    </SyncContext.Provider>,
  );
  return { user, cloud };
}

async function signIn(user: User) {
  await user.click(screen.getByRole('button', { name: 'Account' }));
  const sheet = screen.getByRole('dialog', { name: 'Account' });
  await user.type(within(sheet).getByLabelText('Email'), 'me@example.com');
  await user.type(within(sheet).getByLabelText('Password'), 'secret1');
  await user.click(within(sheet).getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(within(sheet).getByText(/signed in as me@example.com/i)).toBeInTheDocument());
  return sheet;
}

const songTitles = async (user: User) => {
  await user.click(screen.getByRole('button', { name: 'My songs' }));
  const lib = screen.getByRole('dialog', { name: 'My songs' });
  const titles = within(lib).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
  await user.click(within(lib).getByRole('button', { name: 'Close' }));
  return titles;
};

beforeEach(() => localStorage.clear());

describe('cloud sync', () => {
  it('explains how to set it up when Firebase is not configured', async () => {
    const { user } = setup(offlineBackend);
    await user.click(screen.getByRole('button', { name: 'Account' }));
    expect(within(screen.getByRole('dialog', { name: 'Account' })).getByText(/VITE_FIREBASE_API_KEY/)).toBeInTheDocument();
  });

  it('signing in brings in the songs saved in the cloud and uploads this device\'s songs', async () => {
    const cloud = new FakeCloud();
    cloud.songs.set('c1', { song: { ...createSong({ title: 'From my phone' }), id: 'c1', updatedAt: 1 }, deleted: false });
    const { user } = setup(cloud);
    const sheet = await signIn(user);
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(async () => expect(await songTitles(user)).toContain('From my phone'));
    await waitFor(() => expect([...cloud.songs.values()].map((r) => r.song.title)).toContain('Untitled song'));
  });

  it('shows a clear error for a wrong password', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Account' }));
    const sheet = screen.getByRole('dialog', { name: 'Account' });
    await user.type(within(sheet).getByLabelText('Email'), 'me@example.com');
    await user.type(within(sheet).getByLabelText('Password'), 'nope');
    await user.click(within(sheet).getByRole('button', { name: 'Sign in' }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Wrong password.');
  });

  it('uploads edits and deletes', async () => {
    const { user, cloud } = setup();
    const sheet = await signIn(user);
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    const title = screen.getByRole('textbox', { name: 'Song title' });
    await user.clear(title);
    await user.type(title, 'Edited');
    await waitFor(() => expect([...cloud.songs.values()].map((r) => r.song.title)).toContain('Edited'));
    const id = [...cloud.songs.keys()][0]!;
    await user.click(screen.getByRole('button', { name: 'My songs' }));
    const lib = screen.getByRole('dialog', { name: 'My songs' });
    await user.click(within(within(lib).getByRole('listitem', { name: 'Edited' })).getByRole('button', { name: 'Delete' }));
    await user.click(within(within(lib).getByRole('listitem', { name: 'Edited' })).getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(cloud.songs.get(id)?.deleted).toBe(true));
  });

  it('applies changes made on another device', async () => {
    const { user, cloud } = setup();
    const sheet = await signIn(user);
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(cloud.songs.size).toBe(1));
    const [remote] = [...cloud.songs.values()];
    cloud.remoteEdit({ ...remote!.song, title: 'Renamed on laptop', updatedAt: Date.now() + 10_000 });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue('Renamed on laptop'));
  });

  it('signing out keeps the songs on this device', async () => {
    const { user } = setup();
    const sheet = await signIn(user);
    await user.click(within(sheet).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(within(sheet).getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue('Untitled song');
  });
});
