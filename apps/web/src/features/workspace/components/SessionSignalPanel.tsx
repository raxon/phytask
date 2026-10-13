import { Icon } from '../../../shared/ui/Icon';
import { SignalChart } from './SignalChart';
import type { Analysis } from '../model/types';

export function SessionSignalPanel({ analysis }: { analysis: Analysis | null }) {
  return (
    <section className="panel chart-panel" aria-labelledby="chart-title">
      <div className="chart-header">
        <div>
          <p className="eyebrow">THE MOVEMENT BEHIND THE NUMBER</p>
          <h2 id="chart-title">Knee angle over time</h2>
        </div>
        <div className="chart-legend">
          <span>
            <i className="legend-signal" />
            Knee angle
          </span>
          <span>
            <i className="legend-top" />
            Standing &gt; 160°
          </span>
          <span>
            <i className="legend-bottom" />
            Depth &lt; 100°
          </span>
        </div>
      </div>
      {analysis ? (
        <>
          <SignalChart fixture={analysis.fixture} />
          <div className="chart-footer">
            <span>
              <Icon name="file" />
              {analysis.name}
            </span>
            <span>Each dot marks a completed rep</span>
          </div>
        </>
      ) : (
        <div className="chart-empty">
          <Icon name="pulse" />
          <p>Choose a session to explore its movement.</p>
        </div>
      )}
    </section>
  );
}
