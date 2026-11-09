import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChordEditor } from './ChordEditor';
import { shapeFromFrets } from '../music/chordShape';

const marker = (name: RegExp) => screen.queryByRole('button', { name });

describe('fingers outside the visible frets', () => {
  it('shows a marker for a finger above or below the window, and tapping it brings the finger into view', async () => {
    const user = userEvent.setup();
    render(<ChordEditor initialShape={shapeFromFrets('x-x-7-x-x-x')} />);
    expect(marker(/^finger .* string 4 at fret 7/i)).toBeNull(); // in view at first

    for (let i = 0; i < 5; i++) await user.click(screen.getByRole('button', { name: 'Move up the neck' }));
    expect(screen.queryByTestId('dot-2')).toBeNull();
    expect(marker(/finger .* on string 4 at fret 7 is above the view/i)).toBeInTheDocument();

    await user.click(marker(/^finger .* string 4 at fret 7/i)!);
    expect(screen.getByTestId('dot-2')).toBeInTheDocument();
    expect(marker(/^finger .* string 4 at fret 7/i)).toBeNull();
  });

  it('marks fingers below the window too (towards the body)', () => {
    render(<ChordEditor initialShape={shapeFromFrets('x-x-7-x-x-12')} />); // window: frets 7-11
    expect(marker(/string 1 at fret 12 is below the view/i)).toBeInTheDocument();
    expect(marker(/^finger .* string 4/i)).toBeNull();
  });
});
