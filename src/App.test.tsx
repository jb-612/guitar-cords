import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { shapeFromFrets } from './music/chordShape';

type User = ReturnType<typeof userEvent.setup>;

const bars = () => screen.getAllByRole('listitem', { name: /^Bar \d+$/ });
const bar = (n: number) => screen.getByRole('listitem', { name: `Bar ${n}` });
/** Each bar as its sequence: chord symbols, and "-" for rests. */
const lanes = () =>
  bars().map((b) =>
    within(b)
      .queryAllByTestId(/^bar-(hit|rest)$/)
      .map((el) => el.dataset.symbol ?? '-'),
  );
const hits = (n: number) => within(bar(n)).getAllByTestId('bar-hit');

async function openPicker(user: User) {
  await user.click(screen.getByRole('button', { name: /^add chord$/i }));
  return screen.getByRole('dialog', { name: /add a chord/i });
}

async function pick(user: User, dialog: HTMLElement, symbol: string, length?: string) {
  if (length) await user.click(within(within(dialog).getByRole('radiogroup', { name: 'Length' })).getByRole('radio', { name: length }));
  await user.click(within(within(dialog).getByRole('group', { name: 'Common chords' })).getByRole('button', { name: symbol }));
}

async function addFromLibrary(user: User, symbol: string, length?: string) {
  await pick(user, await openPicker(user), symbol, length);
}

async function openHit(user: User, barNo: number, index = 0) {
  await user.click(hits(barNo)[index]!);
  return screen.getByRole('dialog', { name: /chord options/i });
}

const choose = async (user: User, dialog: HTMLElement, group: string, option: string) =>
  user.click(within(within(dialog).getByRole('radiogroup', { name: group })).getByRole('radio', { name: option }));

beforeEach(() => localStorage.clear());

describe('App song flow', () => {
  it('starts with an empty song and an add-chord button', () => {
    render(<App />);
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue('Untitled song');
    expect(screen.getByRole('button', { name: /^add chord$/i })).toBeInTheDocument();
  });

  it('adds chords from the library one after another, each filling a bar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G');
    await addFromLibrary(user, 'C');
    expect(lanes()).toEqual([['G'], ['C']]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('creates a new chord in the editor and adds it to the song', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPicker(user);
    await user.click(screen.getByRole('button', { name: /create a new chord/i }));
    const editor = screen.getByRole('dialog', { name: /new chord/i });
    await user.click(within(editor).getByRole('button', { name: 'Mute string 6' }));
    for (const [s, f] of [[5, 3], [4, 2], [2, 1]] as const) await user.click(within(editor).getByRole('button', { name: `String ${s}, fret ${f}` }));
    await user.click(within(editor).getByRole('button', { name: /save chord/i }));
    expect(lanes()).toEqual([['C']]);
  });

  it('the reported gap: after making a chord half a bar, the next chord fills the other half', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G');
    const sheet = await openHit(user, 1);
    await choose(user, sheet, 'Length', 'Half');
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(lanes()).toEqual([['G', '-']]);
    await addFromLibrary(user, 'C');
    expect(lanes()).toEqual([['G', 'C']]);
  });

  it('picks a length in the picker, then fills the remaining rest by tapping it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G', 'Quarter');
    expect(lanes()).toEqual([['G', '-']]);
    await user.click(within(bar(1)).getByTestId('bar-rest'));
    await pick(user, screen.getByRole('dialog', { name: /add a chord/i }), 'C', 'Fill');
    expect(lanes()).toEqual([['G', 'C']]);
    expect(hits(1)[1]).toHaveAccessibleName(/C, dotted half/);
  });

  it('sets strum direction, arpeggio and cut-off on a hit', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G');
    const sheet = await openHit(user, 1);
    await choose(user, sheet, 'Direction', 'Up');
    await choose(user, sheet, 'Style', 'Arpeggio');
    await choose(user, sheet, 'Ending', 'Cut off');
    expect(hits(1)[0]).toHaveAccessibleName('G, whole, arpeggio up, cut off');
  });

  it('duplicates a hit to build a strumming pattern', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G', 'Quarter');
    const sheet = await openHit(user, 1);
    await user.click(within(sheet).getByRole('button', { name: 'Duplicate' }));
    await user.click(within(sheet).getByRole('button', { name: 'Duplicate' }));
    expect(lanes()).toEqual([['G', 'G', 'G', '-']]);
  });

  async function threeGs(user: User) {
    await addFromLibrary(user, 'G', 'Quarter');
    const sheet = await openHit(user, 1);
    await user.click(within(sheet).getByRole('button', { name: 'Duplicate' }));
    await user.click(within(sheet).getByRole('button', { name: 'Duplicate' }));
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
  }

  it('bass walk: duplicate, then edit just one hit', async () => {
    const user = userEvent.setup();
    render(<App />);
    await threeGs(user);
    const sheet = await openHit(user, 1, 1);
    await user.click(within(sheet).getByRole('button', { name: 'Edit shape' }));
    const editor = screen.getByRole('dialog', { name: 'Edit G' });
    expect(within(editor).getByRole('checkbox', { name: /also update the 2 other g hits/i })).not.toBeChecked();
    const name = within(editor).getByRole('textbox', { name: 'Chord name' });
    await user.clear(name);
    await user.type(name, 'G/F#');
    await user.click(within(editor).getByRole('button', { name: /save chord/i }));
    expect(lanes()).toEqual([['G', 'G/F#', 'G', '-']]);
  });

  it('can update every hit with the same fingering at once', async () => {
    const user = userEvent.setup();
    render(<App />);
    await threeGs(user);
    const sheet = await openHit(user, 1, 1);
    await user.click(within(sheet).getByRole('button', { name: 'Edit shape' }));
    const editor = screen.getByRole('dialog', { name: 'Edit G' });
    await user.click(within(editor).getByRole('checkbox', { name: /also update/i }));
    const name = within(editor).getByRole('textbox', { name: 'Chord name' });
    await user.clear(name);
    await user.type(name, 'Gmaj');
    await user.click(within(editor).getByRole('button', { name: /save chord/i }));
    expect(lanes()).toEqual([['Gmaj', 'Gmaj', 'Gmaj', '-']]);
  });

  it('deleting a hit leaves a rest in its place', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G', 'Half');
    await addFromLibrary(user, 'C');
    const sheet = await openHit(user, 1, 1);
    await user.click(within(sheet).getByRole('button', { name: /delete chord/i }));
    expect(lanes()).toEqual([['G', '-']]);
  });

  it('starts a new song with its own title, time signature and tempo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'New song' }));
    const setup = screen.getByRole('dialog', { name: 'New song' });
    await user.clear(within(setup).getByRole('textbox', { name: 'Title' }));
    await user.type(within(setup).getByRole('textbox', { name: 'Title' }), 'Waltz');
    await user.click(within(setup).getByRole('radio', { name: '3/4' }));
    await user.clear(within(setup).getByRole('spinbutton', { name: 'Tempo (bpm)' }));
    await user.type(within(setup).getByRole('spinbutton', { name: 'Tempo (bpm)' }), '100');
    await user.click(within(setup).getByRole('button', { name: 'Create song' }));
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue('Waltz');
    expect(screen.getByRole('combobox', { name: 'Time signature' })).toHaveValue('3/4');
    expect(screen.getByRole('spinbutton', { name: 'Song tempo (bpm)' })).toHaveValue(100);
    await addFromLibrary(user, 'G');
    expect(hits(1)[0]).toHaveAccessibleName(/G, dotted half/);
  });

  it('changes time signature and tempo from a bar, via its menu or a right-click', async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const c of ['G', 'C', 'D']) await addFromLibrary(user, c);
    await user.click(within(bar(2)).getByRole('button', { name: 'Bar 2 options' }));
    let menu = screen.getByRole('dialog', { name: 'Bar 2' });
    await user.click(within(menu).getByRole('radio', { name: '3/4' }));
    await user.click(within(menu).getByRole('button', { name: 'Close' }));
    expect(within(bar(2)).getByText('3/4')).toBeInTheDocument();
    expect(hits(3)[0]).toHaveAccessibleName(/D, dotted half/);

    fireEvent.contextMenu(bar(3));
    menu = screen.getByRole('dialog', { name: 'Bar 3' });
    await user.clear(within(menu).getByRole('spinbutton', { name: 'Tempo from bar 3' }));
    await user.type(within(menu).getByRole('spinbutton', { name: 'Tempo from bar 3' }), '120');
    await user.click(within(menu).getByRole('button', { name: 'Set tempo' }));
    await user.click(within(menu).getByRole('button', { name: 'Close' }));
    expect(within(bar(3)).getByText('♩ = 120')).toBeInTheDocument();
  });

  it('duplicates a bar from the bar menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G', 'Half');
    await addFromLibrary(user, 'C');
    await user.click(within(bar(1)).getByRole('button', { name: 'Bar 1 options' }));
    await user.click(screen.getByRole('button', { name: 'Duplicate bar' }));
    expect(lanes()).toEqual([['G', 'C'], ['G', 'C']]);
  });

  it('applies a strumming pattern to a bar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G');
    await user.click(within(bar(1)).getByRole('button', { name: 'Bar 1 options' }));
    await user.click(screen.getByRole('button', { name: /eighths/i }));
    expect(lanes()).toEqual([['G', 'G', 'G', 'G', 'G', 'G', 'G', 'G']]);
    expect(hits(1)[1]).toHaveAccessibleName(/strum up/);
  });

  it('inserts and deletes bars from the bar menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFromLibrary(user, 'G');
    await addFromLibrary(user, 'C');
    await user.click(within(bar(1)).getByRole('button', { name: 'Bar 1 options' }));
    await user.click(screen.getByRole('button', { name: 'Insert bar after' }));
    expect(lanes()).toEqual([['G'], ['-'], ['C']]);
    await user.click(within(bar(2)).getByRole('button', { name: 'Bar 2 options' }));
    await user.click(screen.getByRole('button', { name: 'Delete bar' }));
    expect(lanes()).toEqual([['G'], ['C']]);
  });

  it('saves an unrecognised fingering under the creator\'s name and keeps it in My chords', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPicker(user);
    await user.click(screen.getByRole('button', { name: /create a new chord/i }));
    const editor = screen.getByRole('dialog', { name: /new chord/i });
    for (const [s, f] of [[6, 1], [5, 2], [4, 3], [3, 4]] as const) await user.click(within(editor).getByRole('button', { name: `String ${s}, fret ${f}` }));
    await user.click(within(editor).getByRole('button', { name: 'Mute string 2' }));
    await user.click(within(editor).getByRole('button', { name: 'Mute string 1' }));
    await user.type(within(editor).getByRole('textbox', { name: 'Chord name' }), 'Tritone stab');
    await user.click(within(editor).getByRole('button', { name: /save chord/i }));
    expect(lanes()).toEqual([['Tritone stab']]);
    await openPicker(user);
    expect(within(screen.getByRole('group', { name: 'My chords' })).getByRole('button', { name: 'Tritone stab' })).toBeInTheDocument();
  });

  it('suggests a key after a few chords and lets the creator accept it', async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const c of ['G', 'C', 'D', 'G']) await addFromLibrary(user, c);
    await user.click(screen.getByRole('button', { name: /use key g major/i }));
    expect(screen.getByLabelText('Song key')).toHaveValue('G');
  });

  it('types lyrics under a bar and keeps them after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await addFromLibrary(user, 'G');
    await user.type(screen.getByRole('textbox', { name: 'Lyrics for bar 1' }), 'Hello');
    unmount();
    render(<App />);
    expect(screen.getByRole('textbox', { name: 'Lyrics for bar 1' })).toHaveValue('Hello');
  });

  it('opens songs saved by the previous version', () => {
    const old = {
      id: 'old', title: 'Old song', key: null, tempo: 90, beatsPerBar: 4,
      bars: [{ id: 'b1', lyrics: 'kept', chords: [{ id: 'c1', symbol: 'G', shape: shapeFromFrets('320003'), beats: 2 }] }],
    };
    localStorage.setItem('guitar-cords:current-song', JSON.stringify(old));
    render(<App />);
    expect(lanes()).toEqual([['G', '-']]);
    expect(screen.getByRole('textbox', { name: 'Lyrics for bar 1' })).toHaveValue('kept');
  });

  describe('drag and drop', () => {
    /** Drag `from` and release over `over` (hit-testing is stubbed, jsdom has no layout). */
    function drag(from: HTMLElement, over: HTMLElement, opts: { altKey?: boolean } = {}) {
      document.elementFromPoint = () => over;
      fireEvent.pointerDown(from, { button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 });
      fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: 60, clientY: 80 });
      fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: 60, clientY: 80, ...opts });
      fireEvent.click(from);
    }

    async function gcThenEmptyBar(user: User) {
      await addFromLibrary(user, 'G', 'Half');
      await addFromLibrary(user, 'C');
      await user.click(within(bar(1)).getByRole('button', { name: 'Bar 1 options' }));
      await user.click(screen.getByRole('button', { name: 'Insert bar after' }));
    }

    it('moves a chord into a rest in another bar', async () => {
      const user = userEvent.setup();
      render(<App />);
      await gcThenEmptyBar(user);
      drag(hits(1)[0]!, within(bar(2)).getByTestId('bar-rest'));
      expect(lanes()).toEqual([['-', 'C'], ['G', '-']]);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('swaps two chords when dropped on a chord', async () => {
      const user = userEvent.setup();
      render(<App />);
      await gcThenEmptyBar(user);
      drag(hits(1)[0]!, hits(1)[1]!);
      expect(lanes()).toEqual([['C', 'G'], ['-']]);
    });

    it('copies instead of moving with Alt / Option held', async () => {
      const user = userEvent.setup();
      render(<App />);
      await gcThenEmptyBar(user);
      drag(hits(1)[1]!, within(bar(2)).getByTestId('bar-rest'), { altKey: true });
      expect(lanes()).toEqual([['G', 'C'], ['C', '-']]); // a half-bar C keeps its length
    });

    it('a plain click still opens the chord options', async () => {
      const user = userEvent.setup();
      render(<App />);
      await addFromLibrary(user, 'G');
      await user.click(hits(1)[0]!);
      expect(screen.getByRole('dialog', { name: /chord options/i })).toBeInTheDocument();
    });
  });

  describe('reordering bars', () => {
    async function gcd(user: User) {
      for (const c of ['G', 'C', 'D']) await addFromLibrary(user, c);
    }

    it('moves a bar with the arrow keys on its handle, keeping focus on it', async () => {
      const user = userEvent.setup();
      render(<App />);
      await gcd(user);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Move bar 1' }), { key: 'ArrowRight' });
      expect(lanes()).toEqual([['C'], ['G'], ['D']]);
      expect(screen.getByRole('button', { name: 'Move bar 2' })).toHaveFocus();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Move bar 2' }), { key: 'ArrowLeft' });
      expect(lanes()).toEqual([['G'], ['C'], ['D']]);
    });

    it('moves a bar earlier or later from the bar menu', async () => {
      const user = userEvent.setup();
      render(<App />);
      await gcd(user);
      await user.click(within(bar(3)).getByRole('button', { name: 'Bar 3 options' }));
      await user.click(screen.getByRole('button', { name: 'Move bar earlier' }));
      expect(lanes()).toEqual([['G'], ['D'], ['C']]);
      await user.click(within(bar(1)).getByRole('button', { name: 'Bar 1 options' }));
      await user.click(screen.getByRole('button', { name: 'Move bar later' }));
      expect(lanes()).toEqual([['D'], ['G'], ['C']]);
    });

    it('drags a bar by its handle and drops it after another bar', async () => {
      const user = userEvent.setup();
      render(<App />);
      await gcd(user);
      document.elementFromPoint = () => bar(3); // jsdom has no layout: the pointer lands on bar 3's right half
      const handle = screen.getByRole('button', { name: 'Move bar 1' });
      fireEvent.pointerDown(handle, { button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 });
      fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: 300, clientY: 12 });
      expect(screen.getByTestId('bar-drop-line')).toBeInTheDocument();
      fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: 300, clientY: 12 });
      expect(lanes()).toEqual([['C'], ['D'], ['G']]);
    });
  });
});
