import React, { useState } from 'react';
import { Lightbulb, Trash2, Plus } from 'lucide-react';
import { EmptyState } from './Shared.jsx';

function ActivateForm({ item, onActivate, onCancel }) {
  const [outcome, setOutcome] = useState('');
  return (
    <div className="clarify-box">
      <div className="clarify-q">Turn "{item.text}" into a project</div>
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="What does done look like? (optional)" autoFocus />
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onActivate(item, outcome.trim())}>Create project</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function SomedayRow({ item, onActivate, onDelete }) {
  const [activating, setActivating] = useState(false);
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>{item.text}</span>
        <div className="row">
          <button className="btn btn-sm" onClick={() => setActivating((a) => !a)}>Activate</button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDelete(item.id)} aria-label="Delete"><Trash2 size={13} /></button>
        </div>
      </div>
      {activating && (
        <ActivateForm item={item} onActivate={(it, o) => { onActivate(it, o); setActivating(false); }} onCancel={() => setActivating(false)} />
      )}
    </div>
  );
}

function AddSomedayForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) return <button className="btn btn-sm" onClick={() => setOpen(true)}><Plus size={13} /> Add a someday/maybe</button>;
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
    setOpen(false);
  };
  return (
    <div className="card">
      <input className="text-input" style={{ width: '100%', marginBottom: 8 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Something you might want to do one day…" autoFocus />
      <div className="clarify-actions">
        <button className="btn btn-primary btn-sm" onClick={submit}>Add</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export default function SomedayView({ someday, onActivate, onDelete, onAdd }) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}><AddSomedayForm onAdd={onAdd} /></div>
      {someday.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No dreams parked yet">Capture something you're not ready to act on — it'll wait here until you are.</EmptyState>
      ) : (
        someday.map((s) => <SomedayRow key={s.id} item={s} onActivate={onActivate} onDelete={onDelete} />)
      )}
    </div>
  );
}
