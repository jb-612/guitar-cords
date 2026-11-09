const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const MINOR_KEYS = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D', 'G', 'C', 'F', 'Bb', 'Eb'];

/** Key picker; value is "" for no key, "G" for G major, "Em" for E minor. */
export function KeySelect({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <label className="key-select">
      <span className="section-label">Song key</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No key</option>
        <optgroup label="Major">
          {MAJOR_KEYS.map((k) => (
            <option key={k} value={k}>
              {k} major
            </option>
          ))}
        </optgroup>
        <optgroup label="Minor">
          {MINOR_KEYS.map((k) => (
            <option key={k} value={`${k}m`}>
              {k} minor
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
