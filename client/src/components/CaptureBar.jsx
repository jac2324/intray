import React, { useState } from 'react';
import { Plus } from 'lucide-react';

// The one persistent, always-available element across every view. Capture
// is optimistic — onCapture resolves instantly from the caller's point of
// view, so the field clears right away without waiting on the network.
export default function CaptureBar({ onCapture }) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onCapture(t);
    setText('');
  };

  return (
    <div className="capture-wrap">
      <div className="capture-bar">
        <input
          className="capture-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Capture anything on your mind…"
          aria-label="Capture a new item"
        />
        <button className="capture-btn" onClick={submit}>
          <Plus size={15} /> <span className="capture-btn-label">Capture</span>
        </button>
      </div>
    </div>
  );
}
