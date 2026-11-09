import { relativeKey, romanNumeral } from './roman';

describe('romanNumeral', () => {
  it.each([
    ['G', 'G', 'I'],
    ['C', 'G', 'IV'],
    ['D7', 'G', 'V7'],
    ['Em', 'G', 'vi'],
    ['Am7', 'G', 'ii7'],
    ['Cmaj7', 'G', 'IVmaj7'],
    ['F#dim', 'G', 'vii°'],
    ['F#m7b5', 'G', 'viiø7'],
    ['F', 'G', '♭VII'],
    ['Bb', 'G', '♭III'],
    ['Dsus4', 'G', 'Vsus4'],
    ['Am', 'Am', 'i'],
    ['E7', 'Am', 'V7'],
    ['G', 'Am', 'VII'],
    ['F', 'Am', 'VI'],
    ['G#dim', 'Am', 'vii°'],
    ['G/B', 'G', 'I⁶'],
    ['C/G', 'G', 'IV⁶₄'],
    ['D/C', 'G', 'V/C'],
  ])('%s in %s is %s', (chord, key, numeral) => {
    expect(romanNumeral(chord, key)).toBe(numeral);
  });

  it('gives nothing for names it cannot read', () => {
    expect(romanNumeral('My special', 'G')).toBeNull();
    expect(romanNumeral('G', 'nope')).toBeNull();
  });
});

describe('relativeKey', () => {
  it.each([
    ['G', 'Em'],
    ['Em', 'G'],
    ['F', 'Dm'],
    ['Bbm', 'Db'],
    ['C', 'Am'],
  ])('%s <-> %s', (key, rel) => {
    expect(relativeKey(key)).toBe(rel);
  });
});
