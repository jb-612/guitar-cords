# Guitar Cords — Design

A mobile-first guitar chord and song editor. It runs in the browser and as a desktop app (Electron).

## Product decisions (2026-11-09)

| Topic | Decision |
|---|---|
| Stack | React + TypeScript (Vite), with Electron wrapping the same build for desktop |
| Rendering and playback | [alphaTab](https://alphatab.net/): tab and score views, guitar soundfont, tempo, bar-range loop, metronome, playback cursor |
| Music theory | [Tonal](https://github.com/tonaljs/tonal) finds chord candidates; our own code ranks them, detects the song key, transposes and suggests voicings |
| Rhythm | v1: chords per bar (a number of beats per chord, plus a strum pattern). Later: note-level tab editing |
| Lyrics | Yes. Each bar holds lyric text; chord names show above the words and stay in sync during playback |
| Storage | Firebase (Auth + Firestore) on the owner's account, configured with `VITE_FIREBASE_*` in `.env.local` |
| UI | Stylish but classic, pixel-perfect, with micro-animations; learnable without a manual |

## Features

1. **Song canvas**: create a song and build a chord sequence bar by bar. The app suggests the song key as the sequence grows.
2. **Chord library**: pick a chord visually, with diagrams of the suggested voicings.
3. **Chord editor** (when a chord is missing): a six-string diagram whose fret window moves up and down the neck.
   - Each tap places a dot, and fingers are numbered 1→4 in tap order. The thumb is finger 0, displayed as **T**.
   - Each dot's finger can be edited. Dots can be dragged along the frets and across strings.
   - The tap above the nut cycles between open and muted (x).
   - Live chord naming, ranked and spelled for the song key.
4. **Views**: chord view (chord sheet with lyrics), tab view and score view, all from one song model rendered by alphaTab.
5. **Playback**: guitar sound, tempo slower or faster, play once or loop, loop a selected range of bars, metronome.
   - During playback the app follows the score/chords and shows finger positions.
   - Practice mode hides the finger positions and shows only chord names.
6. **Transpose**: shift by semitones, either keeping the shapes (with a capo suggestion) or re-voicing them.
7. **Change key**: re-spells the chords for the new key and suggests new finger positions.

## Architecture

```
src/music/      Pure music-theory core (no React, no I/O). Fully unit-tested.
  chordShape    Fretboard dots and fingers: tap/drag/mute logic, MIDI pitches
  chordSymbol   Parse and format chord symbols and keys, note spelling
  chordNaming   Shape → ranked chord names (uses Tonal Chord.detect)
  keyDetection  Chord sequence → ranked keys (24 major/minor keys)
  transpose     Transpose, change key, capo options
  voicings      Chord symbol → fingering suggestions (open library + E/A barre shapes)
src/            React UI (planned: song/, editor/, player/, services/firebase)
electron/       Desktop wrapper; loads the Vite dev server or dist/index.html
```

Planned next layers:
- **Song model → alphaTex**: convert our song (bars, chords, beats, lyrics, chord diagrams) to alphaTab's text format, so one renderer drives the tab view, score view and playback.
- **Firebase service**: `users/{uid}/songs/{songId}` plus `users/{uid}/chords/{chordId}` for custom shapes.

## Milestones

1. ✅ Project scaffold and music-theory core with tests
2. Chord editor UI (diagram, tap/drag, finger picker, live naming) and the design system (tokens, typography, motion)
3. Song model, chord-per-bar song canvas, lyrics, key suggestion
4. alphaTab integration: tab and score views, playback, tempo, loop, metronome, practice mode
5. Transpose and change-key UI with voicing suggestions
6. Firebase auth and sync
7. Electron packaging (electron-builder) and PWA install for mobile
8. Note-level tab editing
