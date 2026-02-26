"use client";

import type { LineSnapshot } from "@/types";

interface LineChartProps {
  snapshots: LineSnapshot[];
}

// Simple SVG-based line chart - no heavy dependencies required.
// Shows point/odds movement over time.
export function LineChart({ snapshots }: LineChartProps) {
  if (snapshots.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-gray-400">
        Need at least 2 snapshots to display chart
      </div>
    );
  }

  // Extract data points
  const points = snapshots.map((snap) => {
    const primary = snap.outcomes[0];
    return {
      timestamp: new Date(snap.timestamp).getTime(),
      value: primary?.point ?? primary?.price ?? 0,
      bookmaker: snap.bookmaker,
    };
  });

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const width = 600;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const minTime = Math.min(...points.map((p) => p.timestamp));
  const maxTime = Math.max(...points.map((p) => p.timestamp));
  const timeRange = maxTime - minTime || 1;

  const scaleX = (t: number) =>
    padding.left + ((t - minTime) / timeRange) * chartW;
  const scaleY = (v: number) =>
    padding.top + chartH - ((v - minVal) / range) * chartH;

  const pathData = points
    .map((p, i) => {
      const x = scaleX(p.timestamp);
      const y = scaleY(p.value);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Gradient area under line
  const areaPath =
    pathData +
    ` L ${scaleX(points[points.length - 1].timestamp)} ${padding.top + chartH}` +
    ` L ${scaleX(points[0].timestamp)} ${padding.top + chartH} Z`;

  const isPositive = (points[points.length - 1]?.value ?? 0) >= (points[0]?.value ?? 0);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={isPositive ? "#22c55e" : "#ef4444"}
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor={isPositive ? "#22c55e" : "#ef4444"}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + chartH * (1 - frac);
          const val = minVal + range * frac;
          return (
            <g key={frac}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                className="text-gray-200 dark:text-gray-700"
                strokeWidth="0.5"
              />
              <text
                x={padding.left - 4}
                y={y + 3}
                textAnchor="end"
                className="fill-gray-400 text-[8px]"
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Area */}
        <path d={areaPath} fill="url(#lineGrad)" />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={isPositive ? "#22c55e" : "#ef4444"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={scaleX(p.timestamp)}
            cy={scaleY(p.value)}
            r="3"
            fill={isPositive ? "#22c55e" : "#ef4444"}
            className="opacity-70 hover:opacity-100"
          >
            <title>
              {p.bookmaker}: {p.value} @ {new Date(p.timestamp).toLocaleString()}
            </title>
          </circle>
        ))}

        {/* Start/End labels */}
        <text
          x={padding.left}
          y={height - 2}
          className="fill-gray-400 text-[8px]"
        >
          {new Date(minTime).toLocaleDateString()}
        </text>
        <text
          x={width - padding.right}
          y={height - 2}
          textAnchor="end"
          className="fill-gray-400 text-[8px]"
        >
          {new Date(maxTime).toLocaleDateString()}
        </text>
      </svg>
    </div>
  );
}
