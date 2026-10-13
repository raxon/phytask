import { SquatIllustration } from './SquatIllustration';
import { Icon } from '../../../shared/ui/Icon';
import type { DemoPatient } from '@rep-counter/demo-data/patients';
import type { WorkspaceView } from '../model/selectors';

interface Props {
  view: WorkspaceView;
  patient: DemoPatient;
  onSave(): Promise<void>;
}

export function SessionResultPanel({ view, patient, onSave }: Props) {
  const {
    source,
    analysis,
    pendingResult,
    currentResult,
    isSaving,
    isSaved,
    isRunning,
    isInterrupted,
    isCompleted,
    sampleCount,
    totalSamples,
    saveError,
  } = view;
  const status = isSaving
    ? 'Saving'
    : pendingResult
      ? 'Pending save'
      : isRunning
        ? 'Live'
        : isInterrupted
          ? 'Interrupted'
          : isSaved
            ? 'Saved'
            : isCompleted
              ? 'Completed'
              : 'Ready';
  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      <div className="panel-heading">
        <span className="step-number">02</span>
        <div>
          <h2 id="result-title">Session result</h2>
          <p>
            {pendingResult && !analysis
              ? 'A result on this device needs confirmation.'
              : isRunning
                ? 'Counting each movement as it arrives.'
                : isInterrupted
                  ? 'Your current result is kept while the signal is interrupted.'
                  : 'Counted from the live signal in your browser.'}
          </p>
        </div>
        <span
          className={`status-pill ${pendingResult || isInterrupted ? 'pending' : ''} ${isRunning ? 'live' : ''}`}
          role="status"
        >
          <span />
          {status}
        </span>
      </div>
      <div className="result-display">
        <div>
          <p className="result-label">COMPLETED REPS</p>
          <div className="rep-value" data-testid="rep-count" aria-live="polite" aria-atomic="true">
            {currentResult?.reps ?? (source ? 0 : '-')}
            <span>reps</span>
          </div>
          <p className="result-description">
            {currentResult || source
              ? 'Full depth. Back to standing.'
              : 'Choose a signal to begin a session.'}
          </p>
        </div>
        <SquatIllustration />
      </div>
      <div className="result-metrics">
        <div>
          <Icon name="clock" />
          <span>Duration</span>
          <strong data-testid="duration">
            {currentResult ? `${currentResult.durationSec.toFixed(1)}s` : source ? '0.0s' : '-'}
          </strong>
        </div>
        <div>
          <Icon name="pulse" />
          <span>Sample rate</span>
          <strong>
            {source
              ? `${source.fixture.sampleRateHz} Hz`
              : analysis
                ? `${analysis.fixture.sampleRateHz} Hz`
                : '-'}
          </strong>
        </div>
        <div>
          <Icon name="file" />
          <span>Samples received</span>
          <strong data-testid="samples-received">
            {analysis || source ? sampleCount.toLocaleString('en-GB') : '-'}
          </strong>
        </div>
      </div>
      {analysis && isCompleted && (
        <div className="fixture-match">
          <Icon name="check" />
          <span>
            {sampleCount < totalSamples
              ? 'Session finished early'
              : analysis.fixture.expectedReps === undefined
                ? 'Session complete'
                : analysis.fixture.expectedReps === analysis.result.reps
                  ? `Matches the fixture: ${analysis.fixture.expectedReps} expected reps`
                  : `Fixture reference: ${analysis.fixture.expectedReps} expected reps`}
          </span>
        </div>
      )}
      <div className="save-area">
        {pendingResult || isSaving || isSaved ? (
          <button
            type="button"
            className="primary-button"
            disabled={isSaving || isSaved || !pendingResult}
            onClick={() => void onSave()}
          >
            <Icon name={isSaved ? 'check' : 'refresh'} />
            {isSaving ? 'Saving session...' : isSaved ? 'Saved to history' : 'Retry save'}
          </button>
        ) : (
          <div className="automatic-save-note">
            <Icon name={isRunning ? 'pulse' : 'clock'} />
            <span>
              {isRunning
                ? 'Session in progress'
                : isInterrupted
                  ? 'Waiting for the signal to resume'
                  : 'Ready when you are'}
            </span>
          </div>
        )}
        <span className="save-caption">
          {isSaved
            ? `Saved for ${patient.name}`
            : `Saves to ${patient.name.split(' ')[0]}'s history when the session ends`}
        </span>
      </div>
      {saveError && (
        <p role="alert" className="error-message">
          {saveError}
        </p>
      )}
      <span role="status" className="sr-only">
        {isSaved ? 'Session saved successfully.' : ''}
      </span>
    </section>
  );
}
