import { Icon } from '../../../shared/ui/Icon';
import { SignalChart } from './SignalChart';
import type { WorkspaceView } from '../model/selectors';

export function SessionSignalPanel({ view }: { view: WorkspaceView }) {
  const { analysis, source, isRunning, totalSamples } = view;
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
      {analysis && analysis.fixture.angles.length > 0 ? (
        <>
          <SignalChart
            fixture={analysis.fixture}
            totalSamples={totalSamples}
            sourceAngles={source?.fixture.angles ?? analysis.fixture.angles}
            live={isRunning}
          />
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
          <p>
            {isRunning
              ? 'Waiting for the first sample...'
              : source
                ? 'Start a session to see its live signal.'
                : 'Choose a signal to begin.'}
          </p>
        </div>
      )}
    </section>
  );
}
