import React, { useState, useEffect, useRef } from 'react';
import { useGtdData } from './hooks/useGtdData.js';
import CaptureBar from './components/CaptureBar.jsx';
import TabNav from './components/TabNav.jsx';
import InboxView from './components/InboxView.jsx';
import NextActionsView from './components/NextActionsView.jsx';
import ProjectsView from './components/ProjectsView.jsx';
import WaitingView from './components/WaitingView.jsx';
import SomedayView from './components/SomedayView.jsx';
import ReviewView from './components/ReviewView.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import { LoadingScreen, ErrorToast } from './components/Shared.jsx';

const REVIEW_DUE_MS = 7 * 24 * 60 * 60 * 1000;

export default function App() {
  const gtd = useGtdData();
  const [activeTab, setActiveTab] = useState('inbox');
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(null);

  const handleCapture = (text) => {
    gtd.capture(text);
    setPulse(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), 500);
  };

  useEffect(() => () => pulseTimer.current && clearTimeout(pulseTimer.current), []);

  if (gtd.loading) return <LoadingScreen />;
  if (!gtd.authed) return <LoginScreen onLogin={gtd.login} />;
  if (!gtd.data) return <LoadingScreen />;

  const { data } = gtd;
  const inboxCount = data.inbox.length;
  const nextCount = data.actions.filter((a) => a.status === 'next').length;
  const activeProjects = data.projects.filter((p) => p.status === 'active');
  const stalledCount = activeProjects.filter((p) => !data.actions.some((a) => a.projectId === p.id && a.status === 'next')).length;
  const waitingCount = data.waiting.length;
  const somedayCount = data.someday.length;
  const reviewDue = !data.lastReview || Date.now() - data.lastReview > REVIEW_DUE_MS;

  const counts = {
    inbox: inboxCount,
    next: nextCount,
    projects: activeProjects.length,
    waiting: waitingCount,
    someday: somedayCount,
    stalled: stalledCount,
  };

  return (
    <div className="gtd-app">
      <header className="gtd-header">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 className="gtd-title">Intray</h1>
            <div className="gtd-tagline">Capture now. Decide later. Do what matters.</div>
          </div>
          {gtd.authRequired && (
            <button className="btn btn-ghost btn-sm" onClick={gtd.logout}>Sign out</button>
          )}
        </div>
      </header>

      <CaptureBar onCapture={handleCapture} />
      <TabNav activeTab={activeTab} setActiveTab={setActiveTab} counts={counts} pulse={pulse} reviewDue={reviewDue} />

      <main className="gtd-main">
        {activeTab === 'inbox' && (
          <InboxView
            inbox={data.inbox}
            contexts={data.contexts}
            projects={data.projects}
            onResolve={(item, resolution) => gtd.processInboxItem(item.id, resolution)}
            onAddContext={gtd.addContext}
          />
        )}
        {activeTab === 'next' && (
          <NextActionsView
            actions={data.actions}
            projects={activeProjects}
            contexts={data.contexts}
            onComplete={gtd.completeAction}
            onUndo={gtd.undoAction}
            onDelete={gtd.deleteAction}
            onAdd={(text, context, projectId) => gtd.addAction({ text, context, projectId })}
            onAddContext={gtd.addContext}
          />
        )}
        {activeTab === 'projects' && (
          <ProjectsView
            projects={data.projects}
            actions={data.actions}
            contexts={data.contexts}
            onAdd={(name, outcome) => gtd.addProject({ name, outcome })}
            onComplete={gtd.completeProject}
            onAddAction={(projectId, text, context) => gtd.addAction({ text, context, projectId })}
            onAddContext={gtd.addContext}
          />
        )}
        {activeTab === 'waiting' && (
          <WaitingView
            waiting={data.waiting}
            contexts={data.contexts}
            projects={activeProjects}
            onDone={gtd.resolveWaiting}
            onConvertToAction={(item, text, context, projectId) => gtd.convertWaiting(item.id, { text, context, projectId })}
            onAdd={(text, who) => gtd.addWaiting({ text, who })}
            onAddContext={gtd.addContext}
          />
        )}
        {activeTab === 'someday' && (
          <SomedayView
            someday={data.someday}
            onActivate={(item, outcome) => gtd.activateSomeday(item.id, outcome)}
            onDelete={gtd.deleteSomeday}
            onAdd={gtd.addSomeday}
          />
        )}
        {activeTab === 'review' && (
          <ReviewView
            lastReview={data.lastReview}
            reviewChecks={data.reviewChecks}
            counts={counts}
            onToggle={gtd.toggleReviewCheck}
            onCompleteReview={gtd.completeReview}
          />
        )}
      </main>

      <ErrorToast message={gtd.error} />
    </div>
  );
}
