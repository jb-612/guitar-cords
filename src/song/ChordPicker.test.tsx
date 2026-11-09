import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChordPicker } from './ChordPicker';

describe('ChordPicker', () => {
  it('shows the chords that belong to the song key', () => {
    render(<ChordPicker songKey="G" onPick={vi.fn()} onCreate={vi.fn()} onClose={vi.fn()} />);
    const row = screen.getByRole('group', { name: 'In the key of G' });
    expect(within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim']);
  });

  it('shows a library of common chords when there is no key', () => {
    render(<ChordPicker songKey={null} onPick={vi.fn()} onCreate={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('group', { name: /in the key of/i })).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Common chords' })).getByRole('button', { name: 'Am' })).toBeInTheDocument();
  });

  it('picks a chord with its shape', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ChordPicker songKey={null} onPick={onPick} onCreate={vi.fn()} onClose={vi.fn()} />);
    await user.click(within(screen.getByRole('group', { name: 'Common chords' })).getByRole('button', { name: 'C' }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'C', shape: expect.objectContaining({ muted: [0] }) }));
  });

  it('searches any chord name and offers its fingerings', async () => {
    const user = userEvent.setup();
    render(<ChordPicker songKey={null} onPick={vi.fn()} onCreate={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByRole('searchbox', { name: /find a chord/i }), 'F#m7');
    const results = screen.getByRole('group', { name: 'F#m7 fingerings' });
    expect(within(results).getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('says so when a typed name is not a chord', async () => {
    const user = userEvent.setup();
    render(<ChordPicker songKey={null} onPick={vi.fn()} onCreate={vi.fn()} onClose={vi.fn()} />);
    await user.type(screen.getByRole('searchbox', { name: /find a chord/i }), 'Hzz');
    expect(screen.getByText(/no chord called/i)).toBeInTheDocument();
  });

  it('offers to create a new chord', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<ChordPicker songKey={null} onPick={vi.fn()} onCreate={onCreate} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /create a new chord/i }));
    expect(onCreate).toHaveBeenCalled();
  });
});
