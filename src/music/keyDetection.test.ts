import { suggestKeys } from './keyDetection';

const top = (chords: string[]) => {
  const k = suggestKeys(chords)[0];
  return k && `${k.tonic} ${k.mode}`;
};

describe('suggestKeys', () => {
  it('finds G major for G C D G', () => {
    expect(top(['G', 'C', 'D', 'G'])).toBe('G major');
  });

  it('finds A minor for Am F C G Am (tonic at the ends wins over C major)', () => {
    expect(top(['Am', 'F', 'C', 'G', 'Am'])).toBe('A minor');
  });

  it('accepts the harmonic-minor V chord (Am Dm E7 Am)', () => {
    expect(top(['Am', 'Dm', 'E7', 'Am'])).toBe('A minor');
  });

  it('handles flat keys and enharmonics (Bb Eb F Bb)', () => {
    expect(top(['Bb', 'Eb', 'F', 'Bb'])).toBe('Bb major');
  });

  it('reads the chord root from slash chords (C G/B Am F C)', () => {
    expect(top(['C', 'G/B', 'Am', 'F', 'C'])).toBe('C major');
  });

  it('returns confidence between 0 and 1, sorted best first', () => {
    const keys = suggestKeys(['G', 'C', 'D']);
    expect(keys[0]!.confidence).toBeLessThanOrEqual(1);
    expect(keys[0]!.confidence).toBeGreaterThan(keys[keys.length - 1]!.confidence);
  });

  it('returns nothing for an empty sequence', () => {
    expect(suggestKeys([])).toEqual([]);
  });
});
