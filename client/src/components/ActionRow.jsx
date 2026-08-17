import React, { useState } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import ContextPicker from './ContextPicker.jsx';

// A single Next Action row, editable in place. Used both by the main Next
// Actions list (with its project picker) and inside an expanded project
// card (where the project is implied, so that picker is hidden).
export default function ActionRow({ action, contexts, projects, projectName, onComplete, onDelete, onEdit, onAddContext, hideProjectPicker }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(action.text);
  const [context, setContext] = useState(action.context || contexts[0] || '');
  const [projectId, setProjectId] = useState(action.projectId ? String(action.projectId) : '');

  const startEdit = () => {
    setText(action.text);
    setContext(action.context || contexts[0] || '');
    setProjectId(action.projectId ? String(action.projectId) : '');
    setEditing(true);
  };

  const save = () => {
    if (!text.trim()) return;
    onEdit(action.id, {
      text: text.trim(),
      context,
      projectId: hideProjectPicker ? action.projectId : projectId ? Number(projectId) : null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="card">
        <input
          className="text-input"
          style={{ width: '100%', marginBottom: 8 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          autoFocus
        />
        <ContextPicker contexts={contexts} value={context} onChange={setContext} onAddContext={onAddContext} />
        {!hideProjectPicker && (
          <select className="text-input" style={{ width: '100%', marginBottom: 8 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <div className="clarify-actions">
          <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card row" style={{ justifyContent: 'space-between' }}>
      <div className="row">
        <button className="checkbox-btn" onClick={() => onComplete(action.id)} aria-label="Complete action" />
        <span>{action.text}</span>
        {/* Next Actions view already groups by context, so showing the chip
            there would be redundant — only show it in the project view. */}
        {hideProjectPicker && action.context && <span className="chip">{action.context}</span>}
        {!hideProjectPicker && action.projectId && <span className="chip project">{projectName(action.projectId)}</span>}
      </div>
      <div className="row">
        <button className="btn btn-ghost btn-sm btn-icon" onClick={startEdit} aria-label="Edit action">
          <Pencil size={13} />
        </button>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDelete(action.id)} aria-label="Delete action">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
