import React from 'react';
import { Inbox, ListChecks, FolderKanban, Clock, Lightbulb, RotateCcw } from 'lucide-react';

export const TABS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'next', label: 'Next Actions', icon: ListChecks },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'waiting', label: 'Waiting For', icon: Clock },
  { id: 'someday', label: 'Someday', icon: Lightbulb },
  { id: 'review', label: 'Review', icon: RotateCcw },
];

export default function TabNav({ activeTab, setActiveTab, counts, pulse, reviewDue }) {
  return (
    <nav className="tab-nav" aria-label="Sections">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const count = counts[tab.id];
        const isReview = tab.id === 'review';
        return (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <Icon size={16} />
            <span className="tab-label">{tab.label}</span>
            {isReview
              ? reviewDue && <span className="tab-badge due">due</span>
              : count > 0 && (
                  <span className={`tab-badge${tab.id === 'inbox' && pulse ? ' pulse' : ''}`}>{count}</span>
                )}
          </button>
        );
      })}
    </nav>
  );
}
