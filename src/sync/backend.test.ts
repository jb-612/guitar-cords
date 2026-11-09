import { isFirebaseConfigured, sharedFirestore } from './backend';
import type { SyncBackend } from './backend';

describe('Firestore backend', () => {
  it('is created once per page, however often the app asks for it (StrictMode, remounts)', async () => {
    const backend = { signOut: vi.fn(() => Promise.resolve()) } as unknown as SyncBackend;
    const create = vi.fn(() => backend);
    const load = () => Promise.resolve({ createFirestoreBackend: create });
    await Promise.all([sharedFirestore(load), sharedFirestore(load)]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('tests never talk to the real Firebase project (.env.test blanks the config)', () => {
    expect(isFirebaseConfigured()).toBe(false);
  });
});
