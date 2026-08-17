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
