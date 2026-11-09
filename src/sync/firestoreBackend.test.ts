// @vitest-environment node
import { createFirestoreBackend } from './firestoreBackend';

const config = { apiKey: 'test-key', authDomain: 'demo.firebaseapp.com', projectId: 'demo-guitar', appId: '1:1:web:1' };

describe('createFirestoreBackend', () => {
  it('can be created again on the same page (hot reload) without Firebase throwing', () => {
    expect(() => {
      createFirestoreBackend(config);
      createFirestoreBackend(config);
    }).not.toThrow();
  });
});
