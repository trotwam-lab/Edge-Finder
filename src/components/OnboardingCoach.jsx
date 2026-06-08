import React, { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, ClipboardList, Target, X } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';

const STORAGE_KEY = 'edgefinder_onboarding_coach_dismissed';

const steps = [
  {
    title: 'Start with the watchlist',
    body: 'Pick 2-3 games with injury flags, live movement, or book disagreement.',
    icon: Target,
  },
  {
    title: 'Compare the number',
    body: 'Open a game, check the best book, then avoid paying a worse price.',
    icon: BarChart3,
  },
  {
    title: 'Track the bet',
    body: 'Send the play to Tracker so ROI, units, streaks, and CLV become visible.',
    icon: ClipboardList,
  },
];

export default function OnboardingCoach({ onNavigate }) {
  const { tier } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) {
      try {
        window.localStorage.setItem(STORAGE_KEY, 'true');
      } catch {}
    }
  }, [dismissed]);

  if (dismissed) return null;

  const isPro = tier === 'pro';

  return (
    <section className="onboarding-coach" aria-label="First session checklist">
      <div className="onboarding-copy">
        <div className="onboarding-kicker">{isPro ? 'Pro first 10 minutes' : 'Free first 10 minutes'}</div>
        <h2>Use the board like a workflow, not a feed.</h2>
        <p>
          New users should leave the first session knowing where value appears, which book has the best number,
          and whether their process is improving over time.
        </p>
      </div>

      <div className="onboarding-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article className="onboarding-step" key={step.title}>
              <div className="onboarding-step-icon"><Icon size={15} /></div>
              <div>
                <span>Step {index + 1}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="onboarding-actions">
        <button type="button" onClick={() => onNavigate('PRO_TOOLS')} className="onboarding-primary">
          <CheckCircle2 size={15} />
          Build Watchlist
        </button>
        <button type="button" onClick={() => onNavigate('TRACKER')} className="onboarding-secondary">
          Open Tracker
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="onboarding-dismiss"
          aria-label="Dismiss first session checklist"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </section>
  );
}
