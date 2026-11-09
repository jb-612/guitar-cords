# Guitar Cords

A mobile-first guitar chord and song editor for the web and desktop.

- **Chord editor**: tap fingers onto the fretboard (1–4 in tap order, T for thumb), drag them, hold and drag across strings for a barre. Chords are named automatically for the song's key, and you can save your own fingerings under your own names.
- **Songs**: bars that always add up to their time signature, note lengths from whole to 1/32, strum up/down, arpeggio, let ring or cut off, accents, palm mute, triplets, lyrics, sections, repeats and endings. Riffs and bass lines can be written as tab next to the chords.
- **Playback**: guitar sound, drums (basic, bossa nova, swing), metronome, count-in, loop a section, speed trainer, and chord, tab and score views.
- **Theory**: key suggestion, transpose, change key, capo suggestions, Roman numerals, alternate tunings.
- **Sharing**: Guitar Pro, MusicXML and MIDI export, printable chord sheets, share links, import.
- Optional cloud sync with Firebase (Google sign-in).

Built with React, TypeScript and Vite, [alphaTab](https://alphatab.net) for notation and playback, and Electron for the desktop apps.

## Run it

```bash
npm install
npm run dev            # web, http://localhost:5317
npm run electron:dev   # desktop window
npm test
```

Cloud sync is optional: copy `.env.example` to `.env.local` and fill in a Firebase web app config. Without it the app works fully offline on one device.

## Build

```bash
npm run build          # web app in dist/
npm run dist           # desktop installer for this OS in release/
```

Product notes are in `docs/DESIGN.md` and open work in `docs/BACKLOG.md`.

## License

MIT License. Copyright © 2026 Jishu Technologies Ltd. See [LICENSE](LICENSE).
