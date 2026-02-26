"use client";

import { InjuryTracker } from "@/components/injuries/InjuryTracker";

export default function InjuriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Injury Tracker
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Real-time injury tracking with impact analysis. See how injuries
          affect the line and find edges before the market adjusts.
        </p>
      </div>

      <InjuryTracker />
    </div>
  );
}
