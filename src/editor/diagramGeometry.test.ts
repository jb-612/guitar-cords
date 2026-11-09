import { G, pointToCell, stringX, fretY } from './diagramGeometry';

describe('pointToCell', () => {
  it('maps the middle of a fret cell to that string and absolute fret', () => {
    expect(pointToCell({ x: stringX(2), y: fretY(2) - G.fretGap / 2 }, 5)).toEqual({ string: 2, fret: 6 });
  });

  it('maps the zone above the nut to the open/mute toggle', () => {
    expect(pointToCell({ x: stringX(0), y: G.top - 10 }, 1)).toEqual({ string: 0, nut: true });
  });

  it('snaps to the nearest string', () => {
    expect(pointToCell({ x: stringX(3) + G.stringGap * 0.4, y: fretY(1) - 5 }, 1)).toEqual({ string: 3, fret: 1 });
  });

  it('returns null outside the board', () => {
    expect(pointToCell({ x: stringX(5) + G.stringGap, y: fretY(1) }, 1)).toBeNull();
    expect(pointToCell({ x: stringX(0), y: fretY(5) + 30 }, 1)).toBeNull();
  });
});
