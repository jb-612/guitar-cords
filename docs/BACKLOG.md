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

## P2 — important

**Desktop and mobile delivery**
- Package the desktop app with electron-builder for macOS, Windows and Linux, with app icon and signing.
- Make sure alphaTab's worker, audio worklet, SoundFont and fonts load from `file://` in the packaged app. So far this is only verified through the dev server.
- Content Security Policy for Electron (the security warning seen in dev).
- Installable mobile web app (PWA): manifest, offline service worker, home-screen icon.
- Test on real devices (iOS Safari, Android Chrome): audio unlock on iOS, long-press menus, touch dragging.

**Playback and practice**
- Count-in (one bar of clicks before the song starts).
- Volume mix for guitar, drums and metronome.
- Guitar sound choice: steel, nylon, electric clean.
- Strumming-pattern presets applied to a bar (e.g. D DU UDU).
- Swing feel for the guitar part, not just the drums.
- Drum fills at section ends; intro and outro.
- Speed trainer: automatically speed up the loop a little each pass.

**Song structure**
- Sections (Intro / Verse / Chorus / Bridge) with labels.
- Repeat signs, 1st/2nd endings, D.S./D.C.
- Capo setting for the whole song (fingerings stay, sound shifts).
- Multi-select bars and hits: copy, paste, delete a range.

**Sharing and export**
- Export Guitar Pro, MusicXML and MIDI (alphaTab supports these).
- Print or export a PDF chord sheet with lyrics; print tab or score.
- Share a song link (after Firebase).
- Import Guitar Pro / MusicXML files.

## P3 — nice to have

**Chord editor**
- Show the barre finger number once instead of on every string (as printed charts do).
- "Can't go here" shake plus hint when a drop is refused (e.g. under a barre).
- Markers for fingers outside the visible fret window.
- Bigger voicing library: 7ths, 9ths, slash chords, inversions, more movable shapes.
- Alternate tunings (Drop D, DADGAD, open G…) and left-handed mode.

**Rhythm editing**
- Per-hit accent, muted "chuck" strum, palm mute.
- Lyrics aligned to individual beats or syllables, not just per bar.
- Edit triplets in the guitar part.
- Note-level tab editing (single notes, riffs, bass lines): the original step 8.

**Theory helpers**
- Change mode (major ↔ relative minor).
- Show how confident the key suggestion is; offer the second-best key.
- Roman-numeral view (I–V–vi–IV) for the progression.

**App**
- Manual light/dark theme switch (today it follows the system).
- Compact or zoomed chord view; full-screen performance mode.
- Accessibility pass: screen reader walkthrough, keyboard navigation across bars and hits.
- Onboarding: a short first-run walkthrough of tap, hold-to-barre, drag, bar menu.

## Out of scope for now

- Recognising chords from audio recordings (Chordify-style).
- Guitar tuner.
