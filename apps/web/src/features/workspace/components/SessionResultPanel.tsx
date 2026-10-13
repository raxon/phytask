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
  const { analysis, pendingResult, currentResult, isSaving, isSaved, isImporting, saveError } =
    view;
  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      <div className="panel-heading">
        <span className="step-number">02</span>
        <div>
          <h2 id="result-title">Session result</h2>
          <p>
            {pendingResult && !analysis
              ? 'A result on this device needs confirmation.'
              : 'Counted right here in your browser.'}
          </p>
        </div>
        <span className={`status-pill ${pendingResult ? 'pending' : ''}`}>
          <span />
          {isSaving
            ? 'Saving'
            : pendingResult
              ? 'Pending save'
              : currentResult
                ? 'Analyzed'
                : 'Ready'}
        </span>
      </div>
      <div className="result-display">
        <div>
          <p className="result-label">COMPLETED REPS</p>
          <div className="rep-value" data-testid="rep-count">
            {currentResult?.reps ?? '-'}
            <span>reps</span>
          </div>
          <p className="result-description">
            {currentResult
              ? 'Full depth. Back to standing.'
              : 'Choose a session to see your result.'}
          </p>
        </div>
        <SquatIllustration />
      </div>
      <div className="result-metrics">
        <div>
          <Icon name="clock" />
          <span>Duration</span>
          <strong data-testid="duration">
            {currentResult ? `${currentResult.durationSec.toFixed(1)}s` : '-'}
          </strong>
        </div>
        <div>
          <Icon name="pulse" />
          <span>Sample rate</span>
          <strong>{analysis ? `${analysis.fixture.sampleRateHz} Hz` : '-'}</strong>
        </div>
        <div>
          <Icon name="file" />
          <span>Frames analyzed</span>
          <strong>{analysis?.fixture.angles.length.toLocaleString('en-GB') ?? '-'}</strong>
        </div>
      </div>
      {analysis && (
        <div className="fixture-match">
          <Icon name="check" />
          <span>
            {analysis.fixture.expectedReps === undefined
              ? 'Analysis complete'
              : analysis.fixture.expectedReps === analysis.result.reps
                ? `Matches the fixture: ${analysis.fixture.expectedReps} expected reps`
                : `Fixture reference: ${analysis.fixture.expectedReps} expected reps`}
          </span>
        </div>
      )}
      <div className="save-area">
        <button
          type="button"
          className="primary-button"
          disabled={!currentResult || isSaving || isSaved || isImporting}
          onClick={onSave}
        >
          <Icon name={isSaved ? 'check' : pendingResult ? 'refresh' : 'arrow'} />
          {isSaving
            ? 'Saving session...'
            : isSaved
              ? 'Saved to history'
              : pendingResult
                ? 'Retry save'
                : 'Save session'}
        </button>
        <span className="save-caption">
          {isSaved
            ? `Saved for ${patient.name}`
            : `Add this result to ${patient.name.split(' ')[0]}'s history`}
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
