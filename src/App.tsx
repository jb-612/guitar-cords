import { ChordEditor } from './editor/ChordEditor';
import './App.css';

export function App() {
  return (
    <div className="app">
      <header className="app-bar">
        <span className="brand">Guitar Cords</span>
        <span className="app-bar-title">New chord</span>
      </header>
      <ChordEditor />
    </div>
  );
}
