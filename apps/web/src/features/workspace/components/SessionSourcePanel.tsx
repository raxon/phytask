import { useRef, type ChangeEvent } from 'react';
import { Icon } from '../../../shared/ui/Icon';
import { examples, type ExampleSession } from '../model/examples';
import type { FixtureFile } from '../application/ports';
import type { WorkspaceView } from '../model/selectors';
import type { PlaybackSpeed } from '@rep-counter/contracts/signal';

interface Props {
  view: WorkspaceView;
  onChoose(example: ExampleSession): void;
  onImport(file: FixtureFile): Promise<void>;
  onStart(): void;
  onFinish(): Promise<void>;
  onResume(): void;
  onPlaybackSpeed(speed: PlaybackSpeed): void;
}

export function SessionSourcePanel({
  view,
  onChoose,
  onImport,
  onStart,
  onFinish,
  onResume,
  onPlaybackSpeed,
}: Props) {
  const {
    source,
    pendingResult,
    importError,
    isImporting,
    isActive,
    isRunning,
    isInterrupted,
    isCompleted,
    isSaving,
    canStart,
    playbackSpeed,
    sampleCount,
    totalSamples,
    currentAngle,
    progress,
    streamError,
  } = view;
  const sourceLocked = isActive || Boolean(pendingResult) || isSaving;
  const fileInput = useRef<HTMLInputElement>(null);
  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void onImport(file);
  }
  return (
    <section className="panel source-panel" aria-labelledby="source-title">
      <div className="panel-heading">
        <span className="step-number">01</span>
        <div>
          <h2 id="source-title">Session simulator</h2>
          <p>Choose a signal, then start a live session.</p>
        </div>
      </div>
      <div className="sample-list" aria-label="Example sessions">
        {examples.map((example) => (
          <button
            key={example.id}
            type="button"
            disabled={sourceLocked || isImporting}
            aria-pressed={source?.name === example.fileName}
            onClick={() => onChoose(example)}
            className={`sample-card ${source?.name === example.fileName ? 'selected' : ''}`}
          >
            <span className={`mini-signal ${example.id}`}>
              <Icon name="pulse" />
            </span>
            <span className="sample-copy">
              <strong>{example.title}</strong>
              <span>{example.detail}</span>
            </span>
            <span className="radio-mark">
              {source?.name === example.fileName ? <Icon name="check" /> : null}
            </span>
          </button>
        ))}
      </div>
      <div className="or-divider">
        <span>OR IMPORT YOUR OWN</span>
      </div>
      <button
        type="button"
        className="upload-button"
        disabled={sourceLocked || isImporting}
        onClick={() => fileInput.current?.click()}
      >
        <span className="upload-icon">
          <Icon name="upload" />
        </span>
        <strong>{isImporting ? 'Reading JSON...' : 'Choose a JSON file'}</strong>
        <span>Knee-angle data with a sample rate</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Import session JSON"
        className="sr-only"
        disabled={sourceLocked || isImporting}
        onChange={importFile}
      />
      {importError && (
        <p role="alert" className="error-message">
          {importError}
        </p>
      )}
      {pendingResult && (
        <p className="import-note">Confirm the pending result before choosing another session.</p>
      )}
      <div className="simulator-controls">
        <div className="playback-control">
          <span id="playback-label">Playback speed</span>
          <div className="speed-options" role="group" aria-labelledby="playback-label">
            {([1, 4, 8] as const).map((speed) => (
              <button
                key={speed}
                type="button"
                aria-pressed={playbackSpeed === speed}
                disabled={sourceLocked || isImporting}
                onClick={() => onPlaybackSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
        {source && (
          <div className="stream-monitor">
            <div className="stream-monitor-heading">
              <span className={`stream-source ${isRunning ? 'live' : ''}`}>
                <span />
                {source.fixtureId ? 'Demo stream' : 'JSON playback'}
              </span>
              <strong data-testid="live-angle">
                {currentAngle === null ? '-' : `${currentAngle.toFixed(1)}°`}
              </strong>
            </div>
            <div
              className="stream-progress"
              role="progressbar"
              aria-label="Signal progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              aria-valuetext={`${sampleCount} of ${totalSamples} samples received`}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="stream-monitor-footer">
              <span data-testid="sample-progress">
                {sampleCount.toLocaleString('en-GB')} / {totalSamples.toLocaleString('en-GB')}{' '}
                samples
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}
        {isActive ? (
          <div className="session-actions">
            {isInterrupted && (
              <button type="button" className="primary-button" onClick={onResume}>
                <Icon name="play" />
                Resume signal
              </button>
            )}
            <button type="button" className="secondary-button" onClick={() => void onFinish()}>
              <Icon name="stop" />
              Finish session
            </button>
          </div>
        ) : (
          <button type="button" className="primary-button" disabled={!canStart} onClick={onStart}>
            <Icon name="play" />
            {isCompleted ? 'Start another session' : 'Start session'}
          </button>
        )}
        {streamError && (
          <p role="alert" className="error-message">
            {streamError}
          </p>
        )}
      </div>
    </section>
  );
}
