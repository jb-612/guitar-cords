# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mobile-first guitar chord and song editor for the web and desktop. React + TypeScript (Vite), wrapped by Electron. Product decisions, features and milestones are in `docs/DESIGN.md`; open work is in `docs/BACKLOG.md` (keep it updated when finishing or adding items). Read both before starting a feature.

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
npm run lint           # ESLint, zero warnings allowed; the `complexity` rule caps functions at 5
npm run dist           # build desktop installers for this OS into release/ (dist:mac / dist:win / dist:linux)
npm run selftest:packaged  # launch the packaged app: plays a song over app://, renders tab, checks CSP — PASS/FAIL
npm run test:mobile    # with the dev server running: iPhone + Pixel emulation touch checks (scroll vs drag, long-press, barre)
```

## Architecture

- `src/music/` is the pure music-theory core: no React, no I/O, every function returns new values. UI and storage build on it, so keep theory logic here and test it here.
- **Dependency direction:** `chordSymbol` (parsing/spelling/keys) ← `chordNaming`, `keyDetection`, `transpose`. `chordShape` ← `chordNaming`, `voicings`.
- **Tonal (`@tonaljs/tonal`) is used for candidates only.** `Chord.detect` order is unreliable (e.g. it ranks `Em#5` above `C/E`) and its names differ from chord charts (`CM`, `CMadd9`, `C7no5`). All Tonal output goes through `normalizeType` and the ranking in `chordNaming.ts`; never show raw Tonal names. Tonal can't name voicings without a 3rd, so `nameNotes` falls back in order: Tonal → a known chord over a foreign bass (`C/F#`) → a description built from intervals above the bass (`Gmaj7(add13, no3)`).
- Chord names in a song are free text. The creator can type any name (e.g. "Tritone stab"), and their fingerings are kept in My chords (`useMyChords`, localStorage). Code that parses symbols (`parseChord`, transposition, key detection) must tolerate names it can't parse: skip them or leave them unchanged.
- **alphaTab (`@coderline/alphatab`) is planned to render the tab and score views and to handle all playback** (soundfont, tempo, loop, metronome). The plan is to convert the song model to alphaTex rather than build a custom renderer or audio engine.
- `src/editor/` is the chord editor. `editorReducer` holds the interaction rules: tap a cell to place a dot, tap an unselected dot to select it, tap the selected dot to remove it, and the fret window follows nudges and drops. `ChordDiagram` renders an SVG whose layout comes from `diagramGeometry`; `pointToCell` maps pointer positions to cells for drag-and-drop (`useDotDrag`). Clicks, arrow keys and drops all dispatch the same reducer actions, so test behaviour through the reducer or through the click/keyboard paths. jsdom has no SVG layout, so pointer drags can only be verified in a real browser.
- Dot gestures (`useDotDrag`): a quick press is a tap, moving past 6px is a move, and holding `HOLD_MS` turns it into a barre stretch. Stretching dispatches `barre` actions computed from a snapshot (`base`) of the shape taken when the hold began, so dragging back shrinks the barre. Because the pointer is captured on the svg, the browser's click never reaches the dot: taps on dots are handled on pointer-up and the click that follows is swallowed. Cells (empty spots) still use plain `onClick`.
- Barres have no separate type: a barre is the same finger at the same fret on several strings. **A barre is one finger**: moving, removing or re-numbering any piece acts on the whole barre (`moveDot` → `moveBarre`, `removeDot`, `setFinger`). Strings under a barre may hold a higher finger (F = `133211`); tapping such a string adds a finger above the barre, and lifting that finger lets the barre hold the string again (`fillBarres`). Anything at or below the barre's fret on a barred string is refused (`underBarre`), and a barre can't be moved over other fingers, so no finger is ever silently deleted.
- `src/song/` is the song model and canvas. **Rhythm model** (`song.ts`, `rhythm.ts`):
  - Bars hold *events*, either chord hits or rests, with lengths in **units of a 1/32 note**, so every time signature divides exactly.
  - Invariant: **every bar's events add up exactly to its time signature.** Unused time is an explicit rest that the creator can fill. Model functions keep this true: `tidy` merges rests, `refit` pads or trims, `normalize` refits all bars after meter changes, `makeRoom`/`consume` make room or take time.
  - Hits carry `direction` (down/up), `style` (strum/arpeggio) and `sustain` (ring/cut).
  - **Note events** (`kind: 'notes'`, `notes.ts`) hold riff/bass notes as `{string, fret}` (one per string). They sit in bars next to chord hits; `setLength`, `repeatHit`, `moveHit`, `removeEvent` work on any sounding event (`SoundingEvent`). Exports treat them as nameless hits via `notesAsHit` (no strum, no chord name); `transposeSong` shifts their frets.
  - Bars may carry `timeSignature` / `tempo` changes that apply from that bar until the next change. Bar 0's values live on the song itself (`barTimeSignature`, `tempoAt`).
  - Notation (dotted or tied note values) is derived only at export (`splitUnits`).
  - `migrateSong` upgrades songs stored in the old beats-per-chord format; `useStoredSong` runs it on load.
- `App.tsx` owns the song and one `Overlay` at a time: picker (append or fill a rest), editor (new chord, or `hitId` for a new fingering of every hit sharing that voicing), hit options, bar menu (button, right-click or long-press), new-song setup. Every change goes through model functions via `setSong(fn)`.
- `src/player/` is playback plus the tab/score views. `alphaTex.ts` converts a Song into alphaTab's text format: each hit becomes a note with brush `bd/bu` or arpeggio `ad/au`, let ring `lr` or staccato `st`, and dotted `d` or tied `t` continuations; `\ts`/`\tempo` are written at the bars where they change; chord names appear only where the voicing changes; bar lyrics go on each bar's first sounding note. alphaTab skips rests when placing lyrics, so there's one lyric token per sounding note. Its tests parse the output with alphaTab itself (`@vitest-environment node`). The UI talks only to the `PlayerEngine` interface (`engine.ts`); `alphaTabEngine.ts` is the real one, loaded lazily on first Play or Tab/Score, and tests inject `fakeEngineFactory()` via `EngineFactoryContext`. Engine positions are `{ bar, unit }` (alphaTab `playbackStart` ÷ 120 ticks). `usePlayer` owns transport settings and pushes each one to the engine with `useSync`. The score host stays mounted off-screen in chord view so playback works from every view.
- **Drums** (`drums.ts`): basic, bossa and swing patterns, generated per bar from that bar's time signature and written as a second alphaTex track (`\articulation defaults`, names like `kickhit`, `snaresidestick`, `ridemiddle`; plain MIDI numbers don't parse). The track is always exported with the chosen style, and on/off is a live mute (`setDrums` → `changeTrackMute`). Only track 0 is rendered (`api.tex(tex, [0])`).
- **Metronome**: while the song plays, alphaTab's metronome is used. Otherwise `metronome.ts` (Web Audio lookahead scheduler; `clicksBetween` is the pure timing) ticks on its own. It is injected through `MetronomeContext`, and tests use `FakeMetronome`.
- **Editing hits**: drag and drop (`useHitDrag`, pointer events, slots carry `data-slot-id`) calls `moveHit`: onto a rest it moves, onto a chord it swaps, and Alt copies. Editing a hit's shape changes only that hit (`replaceHit`, for bass walks) unless "also update" is checked (`replaceVoicing`).
- alphaTab assets (worker, worklet, fonts, SoundFont) are served by `@coderline/alphatab-vite` in `vite.config.ts`. Audio and the tab/score views can't run in jsdom; verify them in Electron (see the screenshot technique below).
- `src/components/` holds shared pieces: `Sheet` (modal: bottom sheet on phones, centered on ≥760px), `ChordThumb` (static mini diagram), `KeySelect`. Shared control styles (`.btn`, `.section-label`, `.card`) live in `src/styles/controls.css`.
- Styling: every color, radius, shadow and motion value is a CSS variable in `src/styles/tokens.css` (light = ivory/ink/brass, dark = ebony). Animations use `--t-fast`/`--t-med`, which drop to 0 under `prefers-reduced-motion`. Fonts (Fraunces, Inter) are bundled locally via `@fontsource-variable` so Electron works offline.
- `src/library/`: the song library (`library.ts`, pure) and `useLibrary` (persistence, plus per-song undo history from `history.ts`; tagged edits within 800 ms merge into one step). All song edits go through `library.update(fn, tag?)`.
- `src/sync/`: cloud sync behind the `SyncBackend` interface (`backend.ts`). `firestoreBackend.ts` is loaded lazily and only when `VITE_FIREBASE_*` are set; otherwise `offlineBackend` is used. Merge rules are in `merge.ts`: newest `updatedAt` wins; equal timestamps keep the local object, so upload echoes don't reset undo history; deletes travel as tombstones via `library.deleted`. Tests inject `FakeCloud` through `SyncContext`. Firestore rules are in `firestore.rules`.
- Firebase config comes from `VITE_FIREBASE_*` env vars (`.env.example` → `.env.local`, git-ignored).
- `vite.config.ts` uses `base: './'` so `dist/index.html` loads from `file://` in Electron.

## Delivery

- **Desktop**: electron-builder (config in `package.json` → `build`). The packaged app serves `dist/` over a private `app://` protocol (`electron/main.cjs`), because alphaTab's worker, audio worklet and SoundFont don't load from `file://`. That protocol also sends the CSP. The renderer is sandboxed, navigation is locked, and only Firebase auth popups may open inside the app. `GC_SELFTEST=1` runs `electron/selftest.cjs`.
- **Web/PWA**: vite-plugin-pwa (manifest, offline precache including the SoundFont). The service worker registers only over http(s) (`src/pwa.ts`). The web build gets the CSP as a meta tag (`vite.config.ts`). GitHub Pages deploys via `.github/workflows/pages.yml`.
- **CI**: `ci.yml` (lint, typecheck, test, build). `release.yml` builds and self-tests macOS, Windows and Linux apps on `v*` tags.
- **Touch**: emulated CDP touches drift inside scrolled sheets, so `scripts/mobile-check.cjs` uses real touches only for scrolling and touch-type PointerEvents for precise gestures. On phones, the hit drag needs a short hold, the bar long-press ignores chords and controls, and the scroll blocker is registered up front, because browsers decide whether a touch may scroll at touchstart.

## Verifying UI in a real browser

The Chrome extension may not be connected, so scripted Electron runs against the dev server are the fallback. Use `webPreferences: { offscreen: true, backgroundThrottling: false }`; hidden normal windows return stale frames from `capturePage`. In offscreen windows `devicePixelRatio` is not 1, and `sendInputEvent` coordinates must be multiplied by it. Map SVG diagram coordinates to the screen with `svg.getScreenCTM()`, not `getBoundingClientRect` on CSS-transformed SVG.

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
