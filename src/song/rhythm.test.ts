import { barUnits, defaultDirection, lengthName, shortLength, splitUnits, unitsOf, type TimeSignature } from './rhythm';

const ts = (beats: number, unit: TimeSignature['unit']): TimeSignature => ({ beats, unit });

describe('note values in units (1 unit = a 1/32 note)', () => {
  it('converts note values, plain and dotted', () => {
    expect(unitsOf(1)).toBe(32);
    expect(unitsOf(4)).toBe(8);
    expect(unitsOf(32)).toBe(1);
    expect(unitsOf(2, true)).toBe(24);
  });

  it.each([
    [ts(4, 4), 32],
    [ts(3, 4), 24],
    [ts(5, 4), 40],
    [ts(6, 8), 24],
    [ts(7, 8), 28],
    [ts(12, 8), 48],
    [ts(2, 2), 32],
  ])('a bar of %o holds %i units', (sig, units) => {
    expect(barUnits(sig)).toBe(units);
  });
});

describe('splitUnits (notation for a length: dotted where possible, tied otherwise)', () => {
  it.each([
    [32, [{ value: 1, dotted: false }]],
    [24, [{ value: 2, dotted: true }]],
    [12, [{ value: 4, dotted: true }]],
    [40, [{ value: 1, dotted: false }, { value: 4, dotted: false }]],
    [28, [{ value: 2, dotted: true }, { value: 8, dotted: false }]],
    [1, [{ value: 32, dotted: false }]],
    [3, [{ value: 16, dotted: true }]],
  ])('%i units -> %o', (units, parts) => {
    expect(splitUnits(units)).toEqual(parts);
  });

  it('always adds up to the length it was given', () => {
    for (let u = 1; u <= 64; u++) {
      expect(splitUnits(u).reduce((sum, p) => sum + unitsOf(p.value, p.dotted), 0)).toBe(u);
    }
  });
});

describe('defaultDirection (down on the beat grid, up on the off-beats)', () => {
  it.each([
    [0, 'down'],
    [8, 'down'],
    [4, 'up'],
    [12, 'up'],
    [2, 'up'],
    [6, 'up'],
    [16, 'down'],
  ] as const)('a hit starting at unit %i strums %s', (start, dir) => {
    expect(defaultDirection(start)).toBe(dir);
  });
});

describe('lengthName', () => {
  it.each([
    [32, 'whole'],
    [16, 'half'],
    [8, 'quarter'],
    [4, 'eighth'],
    [2, 'sixteenth'],
    [1, 'thirty-second'],
    [24, 'dotted half'],
    [12, 'dotted quarter'],
    [40, 'whole + quarter'],
  ])('%i units is a %s', (units, name) => {
    expect(lengthName(units)).toBe(name);
  });
});

describe('shortLength (compact label under each hit)', () => {
  it.each([
    [32, '1'],
    [16, '½'],
    [8, '¼'],
    [4, '⅛'],
    [2, '1/16'],
    [24, '½.'],
    [40, '1+¼'],
  ])('%i units -> %s', (units, label) => {
    expect(shortLength(units)).toBe(label);
  });
});
