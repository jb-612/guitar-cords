/** First-run walkthrough: the few gestures that make the app click. */
import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import './Tour.css';

const STEPS = [
  { icon: '✋', title: 'Draw any chord', text: 'Tap a string on the fretboard to place a finger. Fingers are numbered 1–4 in the order you tap; tap above the nut for open ○ or muted ×.' },
  { icon: '▬', title: 'Barres and moves', text: 'Hold a finger, then drag across the strings to make a barre. Drag a finger to move it. The chord is named as you go — or type your own name.' },
  { icon: '♪', title: 'Build the song', text: 'Add chords bar by bar, set each length and strum, and drag chords or bars to rearrange. Right-click or long-press a bar for its menu.' },
  { icon: '▶', title: 'Play and practise', text: 'Press play to hear it with drums and a metronome. Loop a section, slow it down, or hide the fingers to learn the shapes by heart.' },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  return (
    <Sheet label="Welcome to Guitar Cords" onClose={onClose}>
      <div className="tour">
        <div className="tour-icon" aria-hidden="true" key={i}>
          {step.icon}
        </div>
        <h2 className="tour-title">{step.title}</h2>
        <p className="tour-text">{step.text}</p>
        <div className="tour-dots" aria-label={`Tip ${i + 1} of ${STEPS.length}`} role="img">
          {STEPS.map((_, n) => (
            <span key={n} className={n === i ? 'is-on' : ''} />
          ))}
        </div>
        <div className="hit-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Skip
          </button>
          <button type="button" className="btn primary" onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
