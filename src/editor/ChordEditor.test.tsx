import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChordEditor } from './ChordEditor';
import { shapeFromFrets } from '../music/chordShape';

const cell = (stringNumber: number, fret: number) => screen.getByRole('button', { name: `String ${stringNumber}, fret ${fret}` });
const chordName = () => screen.getByTestId('chord-name');

async function playC(user: ReturnType<typeof userEvent.setup>) {
  // x32010: strings numbered like guitarists do (6 = low E).
  await user.click(screen.getByRole('button', { name: 'Mute string 6' }));
  await user.click(cell(5, 3));
  await user.click(cell(4, 2));
  await user.click(cell(2, 1));
}

describe('ChordEditor', () => {
  it('starts empty with a hint', () => {
    render(<ChordEditor />);
    expect(screen.getByText(/tap a string/i)).toBeInTheDocument();
  });

  it('offers no names or save before anything is placed', () => {
    render(<ChordEditor />);
    expect(screen.queryByText(/also known as/i)).toBeNull();
    expect(screen.getByRole('button', { name: /save chord/i })).toBeDisabled();
  });

  it('names the chord as fingers are placed', async () => {
    const user = userEvent.setup();
    render(<ChordEditor />);
    await playC(user);
    expect(chordName()).toHaveAccessibleName('C');
  });

  it('does not offer exotic alternatives (no Em#5/C for an open C)', async () => {
    const user = userEvent.setup();
    render(<ChordEditor />);
    await playC(user);
    expect(screen.queryByRole('button', { name: 'Em#5/C' })).toBeNull();
  });

  it('labels dots with the finger number in tap order', async () => {
    const user = userEvent.setup();
    render(<ChordEditor />);
    await playC(user);
    expect(screen.getByTestId('dot-1').textContent).toBe('1');
    expect(screen.getByTestId('dot-2').textContent).toBe('2');
    expect(screen.getByTestId('dot-4').textContent).toBe('3');
  });

  it('changes the selected dot to the thumb, shown as T', async () => {
    const user = userEvent.setup();
    render(<ChordEditor />);
    await user.click(cell(6, 3));
    await user.click(screen.getByRole('radio', { name: 'Thumb' }));
    expect(screen.getByTestId('dot-0').textContent).toBe('T');
  });

  it('lets the creator pick an alternative name', async () => {
    const user = userEvent.setup();
    render(<ChordEditor />);
    // x32253 -> C6, also Am7/C
    await user.click(screen.getByRole('button', { name: 'Mute string 6' }));
    for (const [s, f] of [[5, 3], [4, 2], [3, 2], [2, 5], [1, 3]] as const) await user.click(cell(s, f));
    expect(chordName()).toHaveAccessibleName('C6');
    await user.click(screen.getByRole('button', { name: 'Am7/C' }));
    expect(chordName()).toHaveAccessibleName('Am7/C');
  });

  it('moves the fret window up the neck', async () => {
    const user = userEvent.setup();
    render(<ChordEditor />);
    await user.click(screen.getByRole('button', { name: 'Move up the neck' }));
    expect(cell(6, 2)).toBeInTheDocument();
    expect(screen.getByText('2fr')).toBeInTheDocument();
  });

  it('moves the selected dot with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<ChordEditor />);
    await user.click(cell(5, 3));
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' });
    expect(screen.queryByTestId('dot-1')).toBeNull();
    expect(screen.getByTestId('dot-2')).toBeInTheDocument();
  });

  it('respells the name for the chosen song key', async () => {
    const user = userEvent.setup();
    render(<ChordEditor />);
    // xx4322 -> F# / Gb
    await user.click(screen.getByRole('button', { name: 'Mute string 6' }));
    await user.click(screen.getByRole('button', { name: 'Mute string 5' }));
    for (const [s, f] of [[4, 4], [3, 3], [2, 2], [1, 2]] as const) await user.click(cell(s, f));
    await user.selectOptions(screen.getByLabelText('Song key'), 'Db');
    expect(chordName()).toHaveAccessibleName('Gb');
  });

  it('opens an existing shape for editing', () => {
    render(<ChordEditor initialShape={shapeFromFrets('022000')} />);
    expect(chordName()).toHaveAccessibleName('Em');
  });

  it('can be cancelled', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ChordEditor onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  describe('naming it yourself', () => {
    // 1234xx = F B F B: no chord name exists for this.
    const unnamed = () => shapeFromFrets('1234xx');

    it('precondition: the shape really has no detectable name', () => {
      render(<ChordEditor initialShape={unnamed()} />);
      expect(chordName()).toHaveAccessibleName('Unknown chord');
    });

    it('lets the creator name and save an unrecognised fingering', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<ChordEditor initialShape={unnamed()} onSave={onSave} />);
      const save = screen.getByRole('button', { name: /save chord/i });
      expect(save).toBeDisabled();
      await user.type(screen.getByRole('textbox', { name: 'Chord name' }), 'Tritone stab');
      expect(chordName()).toHaveAccessibleName('Tritone stab');
      await user.click(save);
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tritone stab', frets: '1234xx' }));
    });

    it('pre-fills the detected name and lets the creator override it', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<ChordEditor initialShape={shapeFromFrets('x32010')} onSave={onSave} />);
      const field = screen.getByRole('textbox', { name: 'Chord name' });
      expect(field).toHaveValue('C');
      await user.clear(field);
      await user.type(field, 'C (my way)');
      await user.click(screen.getByRole('button', { name: /save chord/i }));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'C (my way)' }));
    });

    it('picking an alternative replaces a typed name', async () => {
      const user = userEvent.setup();
      render(<ChordEditor initialShape={shapeFromFrets('x32253')} />);
      const field = screen.getByRole('textbox', { name: 'Chord name' });
      await user.clear(field);
      await user.type(field, 'Mine');
      await user.click(screen.getByRole('button', { name: 'Am7/C' }));
      expect(field).toHaveValue('Am7/C');
    });
  });

  it('saves the shape with its chosen name', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ChordEditor onSave={onSave} />);
    await playC(user);
    await user.click(screen.getByRole('button', { name: /save chord/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'C', frets: 'x32010' }));
  });
});
