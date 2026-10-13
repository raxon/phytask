import { useMemo, useSyncExternalStore } from 'react';
import type { Fixture } from '@rep-counter/contracts/fixture';
import { completedRepIndices } from '@rep-counter/domain/repetitions';

function subscribeToViewport(onChange: () => void) {
  const query = window.matchMedia('(max-width: 680px)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const smallViewport = () => window.matchMedia('(max-width: 680px)').matches;

interface Props {
  fixture: Fixture;
  totalSamples: number;
  sourceAngles: readonly number[];
  live: boolean;
}

export function SignalChart({ fixture, totalSamples, sourceAngles, live }: Props) {
  const compact = useSyncExternalStore(subscribeToViewport, smallViewport, () => false);
  const width = compact ? 400 : 940;
  const right = width - 24;
  const plotWidth = right - 48;
  const range = useMemo(() => {
    const min = Math.min(
      60,
      sourceAngles.reduce((a, b) => Math.min(a, b), 60),
    );
    const max = Math.max(
      190,
      sourceAngles.reduce((a, b) => Math.max(a, b), 190),
    );
    return { min, max };
  }, [sourceAngles]);
  const chart = useMemo(() => {
    // Keep the full session timeline fixed while incoming samples extend the trace.
    const x = (i: number) => 48 + (i / Math.max(1, totalSamples - 1)) * plotWidth;
    const y = (angle: number) => 20 + ((range.max - angle) / (range.max - range.min || 1)) * 192;
    const completions = Array.from(completedRepIndices(fixture.angles));
    const points = fixture.angles
      .map((angle, i) => `${x(i).toFixed(2)},${y(angle).toFixed(2)}`)
      .join(' ');
    return { x, y, points, completions };
  }, [fixture, plotWidth, range, totalSamples]);
  const duration = totalSamples / fixture.sampleRateHz;
  return (
    <svg
      viewBox={`0 0 ${width} 252`}
      role="img"
      aria-label={`Knee angle over ${duration.toFixed(1)} seconds. ${fixture.angles.length} of ${totalSamples} samples received. Dashed lines show 100 and 160 degree thresholds.`}
      className="signal-chart"
    >
      <defs>
        <linearGradient id="signal-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity=".1" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[80, 120, 160, 180].map((angle) => (
        <g key={angle}>
          <line x1="48" x2={right} y1={chart.y(angle)} y2={chart.y(angle)} stroke="#e8efed" />
          <text x="33" y={chart.y(angle) + 4} textAnchor="end" className="chart-tick">
            {angle}°
          </text>
        </g>
      ))}
      <line
        x1="48"
        x2={right}
        y1={chart.y(160)}
        y2={chart.y(160)}
        stroke="#7faeb3"
        strokeDasharray="6 5"
      />
      <line
        x1="48"
        x2={right}
        y1={chart.y(100)}
        y2={chart.y(100)}
        stroke="#d2a274"
        strokeDasharray="6 5"
      />
      {fixture.angles.length > 0 && (
        <polygon
          points={`48,212 ${chart.points} ${chart.x(fixture.angles.length - 1)},212`}
          fill="url(#signal-fill)"
        />
      )}
      <polyline
        points={chart.points}
        fill="none"
        stroke="#07877f"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {chart.completions.map((i) => (
        <circle
          key={i}
          cx={chart.x(i)}
          cy={chart.y(fixture.angles[i]!)}
          r="4"
          fill="#07877f"
          stroke="white"
          strokeWidth="2"
        />
      ))}
      {live && fixture.angles.length > 0 && (
        <circle
          cx={chart.x(fixture.angles.length - 1)}
          cy={chart.y(fixture.angles.at(-1)!)}
          r="4"
          fill="#07877f"
          stroke="white"
          strokeWidth="2"
          data-testid="live-signal-marker"
        />
      )}
      {(compact ? [0, 2, 4] : [0, 1, 2, 3, 4]).map((i) => (
        <text
          key={i}
          x={48 + (i * plotWidth) / 4}
          y="240"
          textAnchor="middle"
          className="chart-tick"
        >
          {((duration * i) / 4).toFixed(i === 0 ? 0 : 1)}s
        </text>
      ))}
    </svg>
  );
}
