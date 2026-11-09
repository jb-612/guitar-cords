import {
  EMPTY_SHAPE,
  tapString,
  setFinger,
  moveDot,
  removeDot,
  barreTo,
  extendBarre,
  shapeFromFrets,
  toFretString,
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

describe('barreTo', () => {
  const single = tapAll([[0, 1]]); // finger 1 on low E, fret 1

  it('stretches one finger across strings at its fret', () => {
    const s = barreTo(single, 0, 5);
    expect(s.dots).toHaveLength(6);
    expect(s.dots.every((d) => d.fret === 1 && d.finger === 1)).toBe(true);
  });

  it('keeps fingers placed higher up on the strings it covers (F shape)', () => {
    const f = tapAll([[0, 1], [3, 2], [1, 3], [2, 3]]); // 1 on E1, 2 on G2, 3 on A3, 4 on D3
    expect(toFretString(barreTo(f, 0, 5))).toBe('133211');
    expect(barreTo(f, 0, 5).dots.find((d) => d.string === 3)?.finger).toBe(2);
  });

  it('shrinks from the grabbed end, keeping the other end fixed', () => {
    const full = barreTo(single, 0, 5);
    const s = barreTo(full, 5, 3);
    expect(toFretString(s)).toBe('111100');
  });

  it('joins muted strings into the barre and unmutes them', () => {
    const s = barreTo(toggleMute(single, 4), 0, 5);
    expect(s.muted).toEqual([]);
    expect(toFretString(s)).toBe('111111');
  });

  it('replaces a lower fret or a different finger at the same fret', () => {
    const base = tapAll([[2, 3], [3, 1], [4, 3]]); // finger 1 on D3, finger 2 on G1, finger 3 on B3
    const s = barreTo(base, 2, 4);
    expect(toFretString(s)).toBe('003330');
    expect(s.dots.filter((d) => d.fret === 3).every((d) => d.finger === 1)).toBe(true);
  });

  it('is unchanged when there is no dot on the anchor string', () => {
    expect(barreTo(single, 3, 5)).toBe(single);
  });
});

describe('a barre is one finger', () => {
  // Finger 1 barred across strings 5..1 (A to high E) at fret 2.
  const barre = () => barreTo(tapAll([[1, 2]]), 1, 5);

  it('moves as a whole when any piece is dragged to another fret', () => {
    const s = moveDot(barre(), 2, { string: 2, fret: 1 });
    expect(toFretString(s)).toBe('011111');
  });

  it('shifts across strings as a whole', () => {
    expect(toFretString(moveDot(barre(), 3, { string: 2, fret: 2 }))).toBe('222220');
  });

  it('refuses to shift off the fretboard', () => {
    const b = barre();
    expect(moveDot(b, 3, { string: 4, fret: 2 })).toBe(b);
  });

  it('the reported bug: dragging two pieces away moves the barre, never splits it', () => {
    const once = moveDot(barre(), 2, { string: 2, fret: 1 });
    const twice = moveDot(once, 3, { string: 3, fret: 4 });
    expect(toFretString(twice)).toBe('044444');
    expect(new Set(twice.dots.map((d) => `${d.finger}@${d.fret}`)).size).toBe(1);
  });

  it('refuses another finger dropped under the barre (lower or same fret)', () => {
    const withTwo = tapString(barre(), 0, 3); // finger 2 on low E, outside the barre
    expect(moveDot(withTwo, 0, { string: 3, fret: 1 })).toBe(withTwo);
    expect(moveDot(withTwo, 0, { string: 3, fret: 2 })).toBe(withTwo);
    expect(toFretString(moveDot(withTwo, 0, { string: 3, fret: 4 }))).toBe('022422');
  });

  it('refuses a tap under the barre', () => {
    const b = barre();
    expect(tapString(b, 3, 1)).toBe(b);
  });

  it('removing any piece lifts the whole finger', () => {
    expect(removeDot(barre(), 3).dots).toEqual([]);
  });

  it('changing the finger of a piece changes the whole barre', () => {
    expect(setFinger(barre(), 4, 2).dots.every((d) => d.finger === 2)).toBe(true);
  });
});

describe('tapString over a barre', () => {
  it('adds a new finger above the barre instead of moving the barre (building an F)', () => {
    const barre = barreTo(tapAll([[0, 1]]), 0, 5);
    const f = [[3, 2], [1, 3], [2, 3]].reduce((s, [str, fret]) => tapString(s, str!, fret!), barre);
    expect(toFretString(f)).toBe('133211');
    expect(f.dots.find((d) => d.string === 3)?.finger).toBe(2);
    expect(f.dots.find((d) => d.string === 1)?.finger).toBe(3);
    expect(f.dots.find((d) => d.string === 2)?.finger).toBe(4);
  });
});

describe('extendBarre', () => {
  it('grows a barre one string at a time in the given direction', () => {
    const one = tapAll([[1, 3]]);
    const two = extendBarre(one, 1, 1);
    expect(toFretString(two)).toBe('033000');
    expect(toFretString(extendBarre(two, 1, 1))).toBe('033300');
    expect(toFretString(extendBarre(two, 2, -1))).toBe('333000');
  });

  it('stops at the edge of the fretboard', () => {
    const edge = shapeFromFrets('xxxxx1');
    expect(extendBarre(edge, 5, 1)).toBe(edge);
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
