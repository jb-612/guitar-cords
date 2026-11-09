import { canRedo, canUndo, push, redo, startHistory, undo } from './history';

describe('undo history', () => {
  it('undoes and redoes changes in order', () => {
    let h = startHistory('a');
    h = push(h, 'b', { at: 0 });
    h = push(h, 'c', { at: 1000 });
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
  });

  it('a new change clears the redo list', () => {
    let h = push(push(startHistory('a'), 'b', { at: 0 }), 'c', { at: 1000 });
    h = push(undo(h), 'x', { at: 2000 });
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe('b');
  });

  it('merges quick changes with the same tag (typing) into one step', () => {
    let h = startHistory('');
    h = push(h, 'H', { tag: 'title', at: 0 });
    h = push(h, 'He', { tag: 'title', at: 200 });
    h = push(h, 'Hey', { tag: 'title', at: 400 });
    expect(undo(h).present).toBe('');
    const later = push(h, 'Hey!', { tag: 'title', at: 5000 });
    expect(undo(later).present).toBe('Hey');
  });

  it('does not merge different tags', () => {
    let h = push(startHistory(0), 1, { tag: 'a', at: 0 });
    h = push(h, 2, { tag: 'b', at: 10 });
    expect(undo(h).present).toBe(1);
  });

  it('keeps at most 100 steps', () => {
    let h = startHistory(0);
    for (let i = 1; i <= 150; i++) h = push(h, i, { at: i * 1000 });
    expect(h.past).toHaveLength(100);
  });

  it('undo/redo at the ends do nothing', () => {
    const h = startHistory('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
