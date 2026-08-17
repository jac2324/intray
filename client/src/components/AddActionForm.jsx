import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import ContextPicker from './ContextPicker.jsx';

// Quick-add form for a Next Action, used both standalone (Next Actions view)
// and inline within a project card (with the project picker hidden, since
// the project is implied).
export default function AddActionForm({ contexts, projects, onAdd, onAddContext, hideProjectPicker, label }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [context, setContext] = useState(contexts[0] || '');
  const [projectId, setProjectId] = useState('');

  if (!open) {
    return (
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        <Plus size={13} /> {label || 'Add next action'}
      </button>
    );
  }

  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), context, projectId ? Number(projectId) : null);
    setText('');
    setOpen(false);
  };

  return (
    <div className="card">
      <input
        className="text-input"
        style={{ width: '100%', marginBottom: 8 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's the next physical action?"
        autoFocus
      />
      <ContextPicker contexts={contexts} value={context} onChange={setContext} onAddContext={onAddContext} />
      {!hideProjectPicker && (
        <select
          className="text-input"
          style={{ width: '100%', marginBottom: 8 }}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>
          Add
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
