import React from 'react';
import { Check, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { timeAgo } from './Shared.jsx';

// The classic three-phase weekly review: Get Clear, Get Current, Get
// Creative. A few steps carry a live count pulled straight from the actual
// data instead of a static hint.
const REVIEW_STEPS = [
  { id: 'loose', phase: 'Get Clear', text: 'Collect loose papers & materials', hint: 'Round up anything physical or digital that has landed on your desk, bag, or notes app since last time.' },
  { id: 'inboxzero', phase: 'Get Clear', text: 'Get your Inbox to zero', hint: 'dynamic-inbox' },
  { id: 'reviewactions', phase: 'Get Current', text: 'Review your Next Actions lists', hint: 'Cross off anything already done, and rewrite anything too vague to act on.' },
  { id: 'reviewwaiting', phase: 'Get Current', text: 'Review your Waiting For list', hint: 'dynamic-waiting' },
  { id: 'reviewprojects', phase: 'Get Current', text: 'Review every active project', hint: 'dynamic-projects' },
  { id: 'reviewcalendar', phase: 'Get Current', text: 'Look back and ahead on your calendar', hint: 'Capture any actions that fell out of recent or upcoming events.' },
  { id: 'reviewsomeday', phase: 'Get Creative', text: 'Revisit your Someday/Maybe list', hint: 'dynamic-someday' },
  { id: 'newideas', phase: 'Get Creative', text: 'Capture any new ideas or commitments', hint: "Let your mind wander — anything else you're carrying that isn't captured yet?" },
];

export default function ReviewView({ lastReview, reviewChecks, counts, onToggle, onCompleteReview }) {
  const dynamicHint = (id) => {
    if (id === 'inboxzero') return counts.inbox === 0 ? 'Inbox is already at zero. Nice.' : `${counts.inbox} item${counts.inbox !== 1 ? 's' : ''} still waiting in your inbox.`;
    if (id === 'reviewwaiting') return counts.waiting === 0 ? "You're not waiting on anyone right now." : `${counts.waiting} thing${counts.waiting !== 1 ? 's' : ''} you're waiting on.`;
    if (id === 'reviewprojects') return counts.stalled === 0 ? 'Every active project has a next action.' : `${counts.stalled} project${counts.stalled !== 1 ? 's' : ''} with no next action.`;
    if (id === 'reviewsomeday') return counts.someday === 0 ? 'Nothing parked in Someday/Maybe.' : `${counts.someday} idea${counts.someday !== 1 ? 's' : ''} parked for later.`;
    return null;
  };

  const phases = ['Get Clear', 'Get Current', 'Get Creative'];
  const checkedCount = REVIEW_STEPS.filter((s) => reviewChecks[s.id]).length;

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Last full review: {timeAgo(lastReview)}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{checkedCount} of {REVIEW_STEPS.length} steps checked this time</div>
      </div>

      {phases.map((phase) => (
        <div key={phase}>
          <div className="review-phase-title">
            {phase === 'Get Clear' && <CheckCircle2 size={14} />}
            {phase === 'Get Current' && <RotateCcw size={14} />}
            {phase === 'Get Creative' && <Sparkles size={14} />}
            {phase}
          </div>
          {REVIEW_STEPS.filter((s) => s.phase === phase).map((step) => {
            const checked = !!reviewChecks[step.id];
            const hint = step.hint.startsWith('dynamic') ? dynamicHint(step.id) : step.hint;
            return (
              <div key={step.id} className={`review-step${checked ? ' done' : ''}`}>
                <button className={`checkbox-btn${checked ? ' checked' : ''}`} onClick={() => onToggle(step.id)} aria-label={step.text}>
                  {checked && <Check size={13} color="#fff" />}
                </button>
                <div>
                  <div className="review-step-text">{step.text}</div>
                  <div className="review-step-hint">{hint}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onCompleteReview}>
        <CheckCircle2 size={15} /> Complete weekly review
      </button>
    </div>
  );
}
