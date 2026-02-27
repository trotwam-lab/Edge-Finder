"use client";

import { LineMovementTracker } from "@/components/line-movement/LineMovementTracker";

export default function LineMovementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Line Movement
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Track opening lines, steam moves, and reverse line movement with
          persistent history that extends beyond your session.
        </p>
      </div>

      <LineMovementTracker />
    </div>
  );
}
