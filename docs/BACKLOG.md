# Guitar Cords — Backlog

Last updated 2026-11-09. ✅ = done, everything else is open. Priorities: **P1** next up, **P2** important, **P3** nice to have.

## Done so far

- ✅ Chord editor: tap fingers in order 1–4 plus thumb (T); drag dots; open/mute; movable fret window; hold-and-drag barres (a barre acts as one finger); keyboard control.
- ✅ Chord naming ranked for the song key, with alternatives; your own names; names for voicings without a 3rd; My chords.
- ✅ Visual chord library: chords in the key, common chords, search by name, voicing suggestions (open + barre shapes).
- ✅ Song canvas: bars that are always full, rests to fill, note lengths 1 to 1/32 (dotted and tied), strum up/down, strum or arpeggio, let ring or cut off.
- ✅ Duplicate hit, per-hit edit (bass walks), drag and drop of chords (move, swap, Alt-copy), bar reordering (drag, keys, menu), duplicate/insert/delete bar.
- ✅ Time signatures 2/4 to 12/8, time-signature and tempo changes mid-song, New song setup.
- ✅ Lyrics per bar; key suggestion from the progression.
- ✅ Playback (guitar SoundFont), Chords / Tab / Score views, tempo 25–200%, loop, loop a section of bars, now-playing card, practice mode (hide fingers).
- ✅ Drums (Basic, Bossa nova, Swing) per time signature; standalone metronome with beat indicator.

## P1 — done ✅

| # | Item | Notes |
|---|---|---|
| 1 | ✅ Song library | My songs: open, rename, duplicate, delete (with confirmation); New song adds a song. |
| 2 | ✅ Firebase sign-in + sync | Email/password and Google; songs and My chords; newest edit wins; deletes sync; live updates; offline cache. **Turns on once your config is in `.env.local`** (see `.env.example`), with rules in `firestore.rules`. |
| 3 | ✅ Transpose | Half steps or pick a key; new shapes or same shapes + capo; capo suggestions. |
| 4 | ✅ Change key | Respells chords and re-voices fingerings. |
| 5 | ✅ Undo / redo | Buttons and Ctrl/⌘+Z, Shift+Ctrl/⌘+Z. |
| 6 | ✅ Playback errors | Shown above the transport, dismissable. |
| 7 | ✅ Auto-scroll | The playing bar stays on screen. |

## P2 — done ✅

- ✅ **Desktop apps**: macOS built and self-tested here (plays a song, renders tab, no CSP errors); Linux AppImage and Windows zip cross-built here; `release.yml` builds and self-tests all three on tag. Code signing/notarisation still needs your certificates.
- ✅ **Electron security**: local loopback server, CSP, sandbox, navigation lock; Google sign-in works in the packaged app.
- ✅ **Installable web app (PWA)**: manifest, icons, offline cache, verified to reload offline; GitHub Pages deploy.
- ◐ **Real phones**: emulated iPhone 15 and Pixel 8 with touch (`npm run test:mobile`), which found and fixed 3 touch bugs. **Not yet tried on physical devices.**
- ✅ Count-in, volumes, guitar sound, strum presets, swing feel, drum fills/crash/ending, speed trainer.
- ✅ Sections, repeats and endings, song-wide capo, multi-select with copy/cut/paste/delete.
- ✅ Export Guitar Pro / MusicXML / MIDI / song file, print or PDF chord sheet, share links, import.

## P3 — done ✅

**Chord editor**
- ✅ Barre finger number shown once, as printed charts do.
- ✅ "Can't go here" shake plus hint when a placement is refused (e.g. under a barre).
- ✅ Markers (↑7 / ↓12) for fingers outside the visible frets; tap one to scroll it into view.
- ✅ Bigger voicing library: 7ths, 9ths, slash chords, inversions, movable E/A/D shapes.
- ✅ Alternate tunings (Drop D, half-step down, DADGAD, open G, open D) and left-handed mode.

**Rhythm editing**
- ✅ Per-hit accent, muted "chuck" strum, palm mute.
- ✅ Lyrics per chord (syllables on individual hits), as well as per bar.
- ✅ Triplet strums.
- ✅ Note-level tab: single notes and small groups (riffs, bass lines) entered as string + fret, mixed with chords in any bar; length, duplicate, drag, transpose, playback, tab/score and MusicXML all handle them.

**Theory helpers**
- ✅ Major ↔ relative minor switch.
- ✅ Key-suggestion confidence and the second-best key.
- ✅ Roman-numeral view (I–V–vi–IV).

**App**
- ✅ Light/dark/system theme switch.
- ✅ Compact / normal / large chord view (Settings); full-screen performance mode.
- ✅ Accessibility pass: axe checks on every screen and sheet, focus moves into sheets and back, Tab trapped.
- ✅ First-run walkthrough of tap, hold-to-barre, drag and the bar menu.

## Still open

- **Physical devices**: tested only in iPhone/Pixel emulation.
- **Code signing / notarisation** for the desktop apps: needs your Apple and Windows certificates.
- **Firebase**: sync is built but stays offline until `VITE_FIREBASE_*` is set in `.env.local` (see `.env.example`).
- Tab entry is one event at a time; a fretboard-tap entry mode and techniques (hammer-on, slide, bend) would make riffs faster to write.

## Out of scope for now

- Recognising chords from audio recordings (Chordify-style).
- Guitar tuner.
