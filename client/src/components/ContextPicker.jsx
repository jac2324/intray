import React, { useState } from 'react';

// Contexts are user-extensible everywhere this picker appears — not a fixed
// enum. Typing a new one and hitting Enter both selects it and persists it
// to the server's context list for future use.
export default function ContextPicker({ contexts, value, onChange, onAddContext }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');

  return (
    <div className="chip-picker" style={{ marginBottom: 10 }}>
      {contexts.map((c) => (
        <button
          key={c}
          type="button"
          className={`chip-option${value === c ? ' selected' : ''}`}
          onClick={() => onChange(c)}
        >
          {c}
        </button>
      ))}
      {adding ? (
        <input
          className="text-input"
          style={{ width: 100, padding: '4px 8px', fontSize: 12 }}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              onAddContext(text.trim());
              onChange(text.trim());
              setText('');
              setAdding(false);
            }
          }}
          onBlur={() => setAdding(false)}
          placeholder="New…"
        />
      ) : (
        <button type="button" className="chip-option" onClick={() => setAdding(true)}>
          + New
        </button>
      )}
    </div>
  );
}
