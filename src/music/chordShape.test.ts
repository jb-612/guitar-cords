import {
  EMPTY_SHAPE,
  tapString,
  setFinger,
  moveDot,
  removeDot,
  toggleMute,
  shiftShape,
  soundingMidi,
  viewStartFret,
  type ChordShape,
} from './chordShape';

// String index 0 = low E (6th string), 5 = high E (1st string).
const tapAll = (taps: [number, number][], start: ChordShape = EMPTY_SHAPE) =>
  taps.reduce((s, [str, fret]) => tapString(s, str, fret), start);

describe('tapString', () => {
  it('assigns fingers 1,2,3,4 in tap order', () => {
    const s = tapAll([[1, 3], [2, 2], [4, 1], [3, 4]]);
    expect(s.dots.map((d) => d.finger)).toEqual([1, 2, 3, 4]);
  });

  it('removes a dot when its exact position is tapped again', () => {
    const s = tapAll([[1, 3], [1, 3]]);
    expect(s.dots).toEqual([]);
  });

  it('moves the dot (keeping its finger) when another fret on the same string is tapped', () => {
    const s = tapAll([[1, 3], [1, 5]]);
    expect(s.dots).toEqual([{ string: 1, fret: 5, finger: 1 }]);
  });

  it('reuses the lowest free finger after a removal', () => {
    const s = tapAll([[1, 3], [2, 2], [1, 3], [4, 1]]);
    expect(s.dots).toEqual([
      { string: 2, fret: 2, finger: 2 },
      { string: 4, fret: 1, finger: 1 },
    ]);
  });

  it('when all four fingers are used, a tap on the same fret as finger 1 extends it as a barre', () => {
    const s = tapAll([[0, 1], [3, 3], [4, 3], [2, 2], [5, 1]]);
    expect(s.dots.find((d) => d.string === 5)?.finger).toBe(1);
  });

  it('clears a mute when the muted string is fretted', () => {
    const s = tapString(toggleMute(EMPTY_SHAPE, 0), 0, 3);
    expect(s.muted).toEqual([]);
  });
});

describe('setFinger', () => {
  it('changes the finger of a dot, including thumb (0)', () => {
    const s = setFinger(tapAll([[0, 3]]), 0, 0);
    expect(s.dots[0]?.finger).toBe(0);
  });
});

describe('moveDot', () => {
  it('drags a dot to another string and fret', () => {
    const s = moveDot(tapAll([[1, 3]]), 1, { string: 2, fret: 4 });
    expect(s.dots).toEqual([{ string: 2, fret: 4, finger: 1 }]);
  });

  it('refuses to drop onto a string that already has a dot', () => {
    const before = tapAll([[1, 3], [2, 2]]);
    expect(moveDot(before, 1, { string: 2, fret: 5 })).toBe(before);
  });

  it('refuses frets below 1', () => {
    const before = tapAll([[1, 1]]);
    expect(moveDot(before, 1, { string: 1, fret: 0 })).toBe(before);
  });
});

describe('removeDot', () => {
  it('removes the dot on a string, leaving it open', () => {
    const s = removeDot(tapAll([[1, 3], [2, 2]]), 1);
    expect(s.dots).toEqual([{ string: 2, fret: 2, finger: 2 }]);
    expect(s.muted).toEqual([]);
  });
});

describe('toggleMute', () => {
  it('toggles an open string between open and muted', () => {
    const once = toggleMute(EMPTY_SHAPE, 0);
    expect(once.muted).toEqual([0]);
    expect(toggleMute(once, 0).muted).toEqual([]);
  });

  it('muting a fretted string removes its dot', () => {
    const s = toggleMute(tapAll([[0, 3]]), 0);
    expect(s.dots).toEqual([]);
    expect(s.muted).toEqual([0]);
  });
});

describe('shiftShape', () => {
  it('moves every dot up the neck', () => {
    const s = shiftShape(tapAll([[1, 3], [2, 2]]), 2);
    expect(s?.dots.map((d) => d.fret)).toEqual([5, 4]);
  });

  it('returns null if a dot would fall below fret 1', () => {
    expect(shiftShape(tapAll([[1, 1]]), -1)).toBeNull();
  });
});

describe('soundingMidi', () => {
  it('computes pitches for an open C chord (x32010)', () => {
    const c = toggleMute(tapAll([[1, 3], [2, 2], [4, 1]]), 0);
    expect(soundingMidi(c)).toEqual([null, 48, 52, 55, 60, 64]);
  });
});

describe('viewStartFret', () => {
  it('shows the nut for low-position chords', () => {
    expect(viewStartFret(tapAll([[1, 3], [2, 2]]))).toBe(1);
  });

  it('starts at the lowest fret for chords high on the neck', () => {
    expect(viewStartFret(tapAll([[0, 7], [1, 9]]))).toBe(7);
  });
});
