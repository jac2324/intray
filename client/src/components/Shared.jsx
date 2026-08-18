import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="gtd-app center-screen">
      <div className="row" style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
        <Loader2 size={16} className="spin" /> Loading your system…
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="empty-state">
      <Icon size={28} />
      <div className="empty-title">{title}</div>
      <p>{children}</p>
    </div>
  );
}

export function ErrorToast({ message }) {
  if (!message) return null;
  return <div className="error-toast">{message}</div>;
}

export function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Due dates are stored as plain 'YYYY-MM-DD' strings (no time-of-day), so
// they're parsed as LOCAL dates here rather than handed to `new Date(str)`
// directly — the Date constructor treats a bare date-only ISO string as UTC
// midnight, which shifts the displayed day backward by one in any timezone
// west of UTC. Parsing the parts manually and using the local-time
// constructor avoids that off-by-one bug entirely.
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDueDate(dateStr) {
  if (!dateStr) return '';
  return parseLocalDate(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Plain string comparison works correctly for 'YYYY-MM-DD' — no date
// parsing needed, and no timezone concerns since both sides are the same
// format.
export function isOverdue(dateStr) {
  if (!dateStr) return false;
  return dateStr < todayStr();
}

export function timeAgo(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const day = 86400000;
  const days = Math.floor(diff / day);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  return `${weeks} weeks ago`;
}
