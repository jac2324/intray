import React, { useState } from 'react';
import { ArrowRight, Check, Trash2, Lightbulb, Inbox, Mic, ChevronDown, ChevronRight } from 'lucide-react';
import ContextPicker from './ContextPicker.jsx';
import VoicePlayer from './VoicePlayer.jsx';
import { EmptyState, fmtDate } from './Shared.jsx';

// The GTD clarify flow, one step at a time:
//   actionable? -> no: trash / someday
//               -> yes: <2min? -> yes: do it now
//                               -> no: yours to do? -> delegate -> waiting for
//                                                    -> keep -> next action
//
// Voice notes go through the same flow. Their stored text is just the
// "Voice note" placeholder, so anything that becomes a real record (action,
// Someday, Waiting) needs text the user types after listening — `text` starts
// empty for them. A "Keep this recording" checkbox (off by default) decides
// whether the audio is archived or deleted when the item is processed.
function InboxItem({ item, contexts, projects, openActionOptions, onResolve, onAddContext }) {
  const isVoice = !!item.voiceNoteId || !!item._pendingVoice;
  const [step, setStep] = useState('closed');
  const [text, setText] = useState(isVoice ? '' : item.text);
  const [keepRecording, setKeepRecording] = useState(false);
  const [context, setContext] = useState(contexts[0] || '');
  const [projectChoice, setProjectChoice] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [parentChoice, setParentChoice] = useState('');
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => setStep('closed');

  const resolve = async (resolution) => {
    setBusy(true);
    try {
      await onResolve(item, isVoice && keepRecording ? { ...resolution, keepRecording: true } : resolution);
    } finally {
      setBusy(false);
    }
  };

  // For voice notes, the typed text rides along on every resolution: it's
  // required for Someday/Waiting/Action, and optional (it just labels a kept
  // recording) for Trash/Done. Plain text items send nothing extra.
  const typed = isVoice && text.trim() ? { text: text.trim() } : {};
  const needsTyped = isVoice && !text.trim();

  const finishTrash = () => resolve({ type: 'trash', ...typed });
  const finishSomeday = () => {
    if (needsTyped) return;
    resolve({ type: 'someday', ...typed });
  };
  const finishDone = () => resolve({ type: 'done', ...typed });
  const finishWaiting = () => {
    if (!who.trim() || needsTyped) return;
    resolve({ type: 'waiting', who: who.trim(), ...typed });
  };
  const finishAction = () => {
    if (!text.trim()) return;
    if (parentChoice) {
      // Attaching to an existing action as a sub-step — project is
      // inherited from that parent, so no project fields are sent.
      resolve({ type: 'action', text: text.trim(), context, parentActionId: Number(parentChoice) });
      return;
    }
    resolve({
      type: 'action',
      text: text.trim(),
      context,
      projectId: projectChoice && projectChoice !== 'new' ? Number(projectChoice) : null,
      newProjectName: projectChoice === 'new' ? newProjectName.trim() : null,
    });
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        {isVoice ? (
          <div className="row row-wrap" style={{ minWidth: 0, gap: 8 }}>
            <Mic size={15} color="var(--indigo)" aria-hidden="true" />
            <span>Voice note</span>
            {item.voiceNoteId ? (
              <VoicePlayer src={`/api/voice-notes/${item.voiceNoteId}/audio`} durationMs={item.audioDurationMs} />
            ) : (
              <span className="chip">waiting to sync</span>
            )}
          </div>
        ) : (
          <span>{item.text}</span>
        )}
        {step === 'closed' && (
          <button className="btn btn-sm" onClick={() => setStep('actionable')} disabled={item._optimistic}>
            Process <ArrowRight size={13} />
          </button>
        )}
      </div>

      {isVoice && step !== 'closed' && (
        <label className="keep-recording">
          <input type="checkbox" checked={keepRecording} onChange={(e) => setKeepRecording(e.target.checked)} />
          Keep this recording after I process it
        </label>
      )}

      {step === 'actionable' && (
        <div className="clarify-box">
          <div className="clarify-q">Is this actionable?</div>
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setStep('twoMin')}>Yes</button>
            <button className="btn btn-sm" onClick={() => setStep('notActionable')}>No</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {step === 'notActionable' && (
        <div className="clarify-box">
          <div className="clarify-q">Not actionable — what should happen to it?</div>
          {isVoice && (
            <input
              className="text-input"
              style={{ width: '100%', marginBottom: 10 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What was it about? (needed for Someday/Maybe)"
            />
          )}
          <div className="clarify-actions">
            <button className="btn btn-sm" disabled={busy || needsTyped} onClick={finishSomeday}><Lightbulb size={13} /> Someday/Maybe</button>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={finishTrash}><Trash2 size={13} /> Trash it</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'twoMin' && (
        <div className="clarify-box">
          <div className="clarify-q">Will it take less than 2 minutes?</div>
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={finishDone}><Check size={13} /> Yes — do it now</button>
            <button className="btn btn-sm" onClick={() => setStep('whoDoes')}>No</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'whoDoes' && (
        <div className="clarify-box">
          <div className="clarify-q">Is this yours to do?</div>
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setStep('nextAction')}>I'll do it</button>
            <button className="btn btn-sm" onClick={() => setStep('delegate')}>Delegate it</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'delegate' && (
        <div className="clarify-box">
          <div className="clarify-q">Who's it waiting on?</div>
          <input
            className="text-input"
            style={{ width: '100%', marginBottom: 10 }}
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="e.g. Sam, the plumber…"
            autoFocus
          />
          {isVoice && (
            <input
              className="text-input"
              style={{ width: '100%', marginBottom: 10 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What are you waiting for?"
            />
          )}
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" disabled={busy || !who.trim() || needsTyped} onClick={finishWaiting}>Add to Waiting For</button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}

      {step === 'nextAction' && (
        <div className="clarify-box">
          <div className="clarify-q">Set the next action</div>
          <input
            className="text-input"
            style={{ width: '100%', marginBottom: 10 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isVoice ? 'Type the next action…' : undefined}
          />
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Context</div>
          <ContextPicker contexts={contexts} value={context} onChange={setContext} onAddContext={onAddContext} />
          {openActionOptions.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Attach to an existing action (optional)</div>
              <select className="text-input" style={{ width: '100%', marginBottom: 10 }} value={parentChoice} onChange={(e) => setParentChoice(e.target.value)}>
                <option value="">— Top-level action —</option>
                {openActionOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </>
          )}
          {!parentChoice && (
            <>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>Project (optional)</div>
              <select className="text-input" style={{ width: '100%', marginBottom: 10 }} value={projectChoice} onChange={(e) => setProjectChoice(e.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="new">+ New project…</option>
              </select>
              {projectChoice === 'new' && (
                <input className="text-input" style={{ width: '100%', marginBottom: 10 }} value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Project name" />
              )}
            </>
          )}
          {parentChoice && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
              Project is inherited from the parent action.
            </div>
          )}
          <div className="clarify-actions">
            <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()} onClick={finishAction}>
              {parentChoice ? 'Add as Sub-action' : 'Add Next Action'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Recordings kept via "Keep this recording". Lives at the bottom of the Inbox
// view (not its own tab), and — like "Recently completed" on Next Actions —
// always renders its toggle with a live count, so it stays discoverable even
// when empty.
function SavedRecordings({ recordings, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 20 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Saved recordings ({recordings.length})
      </button>
      {open &&
        (recordings.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8, padding: '4px 2px' }}>
            Nothing saved yet — tick “Keep this recording” while processing a voice note and it will be kept here.
          </div>
        ) : (
          recordings.map((r) => (
            <div key={r.id} className="card row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div>{r.keptLabel}</div>
                <div className="row" style={{ gap: 10, marginTop: 4 }}>
                  <VoicePlayer src={`/api/voice-notes/${r.id}/audio`} durationMs={r.durationMs} />
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Recorded {fmtDate(r.createdAt)}</span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                aria-label="Delete recording"
                onClick={() => {
                  if (window.confirm('Delete this recording? This can’t be undone.')) onDelete(r.id);
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        ))}
    </div>
  );
}

export default function InboxView({ inbox, savedRecordings, contexts, projects, openActionOptions, onResolve, onAddContext, onDeleteRecording }) {
  return (
    <div>
      {inbox.length === 0 ? (
        <EmptyState icon={Inbox} title="Inbox zero">
          Nothing waiting to be processed. Capture something above whenever it crosses your mind.
        </EmptyState>
      ) : (
        inbox.map((item) => (
          <InboxItem
            key={item.id}
            item={item}
            contexts={contexts}
            projects={projects}
            openActionOptions={openActionOptions}
            onResolve={onResolve}
            onAddContext={onAddContext}
          />
        ))
      )}
      <SavedRecordings recordings={savedRecordings || []} onDelete={onDeleteRecording} />
    </div>
  );
}
