# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mobile-first guitar chord and song editor for the web and desktop. React + TypeScript (Vite), wrapped by Electron. Product decisions, features and milestones are in `docs/DESIGN.md`; read it before starting a feature.

## Commands

```bash
npm run dev            # Vite dev server (web) on fixed port 5317 (vite.config.ts)
npm run electron:dev   # Vite + Electron window against the dev server
npm run electron:start # production build, then open in Electron
npm run build          # tsc -b && vite build -> dist/
npm test               # vitest run (all tests)
npx vitest run src/music/chordNaming.test.ts   # one file
npx vitest run -t "names x32010"               # tests matching a name
npm run typecheck
npm run lint           # ESLint; the `complexity` rule warns above 5
```

## Architecture

- `src/music/` is the pure music-theory core: no React, no I/O, every function returns new values. UI and storage build on it, so keep theory logic here and test it here.
- **Dependency direction:** `chordSymbol` (parsing/spelling/keys) ← `chordNaming`, `keyDetection`, `transpose`. `chordShape` ← `chordNaming`, `voicings`.
- **Tonal (`@tonaljs/tonal`) is used for candidates only.** `Chord.detect` order is unreliable (e.g. it ranks `Em#5` above `C/E`) and its names differ from chord charts (`CM`, `CMadd9`, `C7no5`). All Tonal output goes through `normalizeType` and the ranking in `chordNaming.ts`; never show raw Tonal names. Tonal can't name voicings without a 3rd, so `nameNotes` falls back in order: Tonal → a known chord over a foreign bass (`C/F#`) → a description built from intervals above the bass (`Gmaj7(add13, no3)`).
- Chord names in a song are free text. The creator can type any name (e.g. "Tritone stab"), and their fingerings are kept in My chords (`useMyChords`, localStorage). Code that parses symbols (`parseChord`, transposition, key detection) must tolerate names it can't parse: skip them or leave them unchanged.
- **alphaTab (`@coderline/alphatab`) is planned to render the tab and score views and to handle all playback** (soundfont, tempo, loop, metronome). The plan is to convert the song model to alphaTex rather than build a custom renderer or audio engine.
- `src/editor/` is the chord editor. `editorReducer` holds the interaction rules: tap a cell to place a dot, tap an unselected dot to select it, tap the selected dot to remove it, and the fret window follows nudges and drops. `ChordDiagram` renders an SVG whose layout comes from `diagramGeometry`; `pointToCell` maps pointer positions to cells for drag-and-drop (`useDotDrag`). Clicks, arrow keys and drops all dispatch the same reducer actions, so test behaviour through the reducer or through the click/keyboard paths. jsdom has no SVG layout, so pointer drags can only be verified in a real browser.
- Dot gestures (`useDotDrag`): a quick press is a tap, moving past 6px is a move, and holding `HOLD_MS` turns it into a barre stretch. Stretching dispatches `barre` actions computed from a snapshot (`base`) of the shape taken when the hold began, so dragging back shrinks the barre. Because the pointer is captured on the svg, the browser's click never reaches the dot: taps on dots are handled on pointer-up and the click that follows is swallowed. Cells (empty spots) still use plain `onClick`.
- Barres have no separate type: a barre is the same finger at the same fret on several strings (`barreTo`, `extendBarre`). Strings under a barre may hold a higher finger (F = `133211`); tapping such a string adds a new finger rather than moving the barre.
- `src/song/` is the song canvas. `song.ts` is the pure model: bars hold chords (with `beats`) and a lyric line. `addChord` fills the last bar or starts a new one; `suggestedKey` waits for 3+ chords. `App.tsx` owns the song (`useStoredSong`, which autosaves to localStorage until Firebase sync) and one `Overlay` at a time: picker → editor (new chord, or `chordId` to edit) → chord actions. Every change goes through `setSong(fn)` with model functions.
- `src/components/` holds shared pieces: `Sheet` (modal: bottom sheet on phones, centered on ≥760px), `ChordThumb` (static mini diagram), `KeySelect`. Shared control styles (`.btn`, `.section-label`, `.card`) live in `src/styles/controls.css`.
- Styling: every color, radius, shadow and motion value is a CSS variable in `src/styles/tokens.css` (light = ivory/ink/brass, dark = ebony). Animations use `--t-fast`/`--t-med`, which drop to 0 under `prefers-reduced-motion`. Fonts (Fraunces, Inter) are bundled locally via `@fontsource-variable` so Electron works offline.
- Firebase config comes from `VITE_FIREBASE_*` env vars (`.env.example` → `.env.local`, git-ignored).
- `vite.config.ts` uses `base: './'` so `dist/index.html` loads from `file://` in Electron.

## Domain conventions

- String index 0 = low E (6th string) … 5 = high E. Fret strings such as `x32010` list the low E first; use dash-separated form for frets ≥ 10 (`x-10-12-12-10-x`).
- Frets are absolute. A string with no dot and not muted is open. One dot per string; a barre is the same finger on several strings at one fret.
- Keyboard on the diagram: arrows move the selected finger, Shift+←/→ extends it into a barre, 1–4/T set the finger, Delete removes it.
- Fingers: 1–4 are assigned in tap order; 0 = thumb and is displayed as **"T"** (because "0" means an open string on chord diagrams).
- Chord symbols use chart form: major has no suffix (`C`, `G/B`, `F#m7b5`). Keys are written `G`, `F#m`, `Bb`, `Ebm`.
- Spelling follows the key signature (`spellingForKey`): flat keys use flats and sharp keys use sharps. C and Am, and the no-key case, use common guitar names (`C#`, `Eb`, `F#`, `Ab`, `Bb`).
- Minor keys include the harmonic-minor V and vii° as diatonic.
- Every shape in `VOICING_LIBRARY` must name to its own symbol; a test enforces this.

## Working rules

- Write tests before implementing new behavior or bug fixes. Tests sit next to their source as `*.test.ts(x)`, using Vitest + Testing Library in jsdom.
- When changing a function, keep its cyclomatic complexity ≤ 5 and report any function above that.
- Don't push to git without asking first.
