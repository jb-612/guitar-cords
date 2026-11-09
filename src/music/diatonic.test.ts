import { diatonicChords } from './diatonic';

describe('diatonicChords', () => {
  it('lists the seven triads of a major key', () => {
    expect(diatonicChords('G')).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim']);
  });

  it('spells flat keys with flats', () => {
    expect(diatonicChords('F')).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim']);
  });

  it('uses the harmonic-minor V in minor keys', () => {
    expect(diatonicChords('Am')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'E', 'F', 'G']);
  });

  it('returns nothing for an unknown key', () => {
    expect(diatonicChords('nope')).toEqual([]);
  });
});
