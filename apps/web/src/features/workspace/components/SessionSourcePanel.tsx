import { useRef, type ChangeEvent } from 'react';
import { Icon } from '../../../shared/ui/Icon';
import { examples, type ExampleSession } from '../model/examples';
import type { FixtureFile } from '../application/ports';
import type { WorkspaceView } from '../model/selectors';

interface Props {
  view: WorkspaceView;
  onChoose(example: ExampleSession): void;
  onImport(file: FixtureFile): Promise<void>;
}

export function SessionSourcePanel({ view, onChoose, onImport }: Props) {
  const { analysis, pendingResult, importError } = view;
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
          <h2 id="source-title">Choose a session</h2>
          <p>Start with a sample or use your own file.</p>
        </div>
      </div>
      <div className="sample-list" aria-label="Example sessions">
        {examples.map((example) => (
          <button
            key={example.id}
            type="button"
            disabled={Boolean(pendingResult)}
            aria-pressed={analysis?.name === example.fileName}
            onClick={() => onChoose(example)}
            className={`sample-card ${analysis?.name === example.fileName ? 'selected' : ''}`}
          >
            <span className={`mini-signal ${example.id}`}>
              <Icon name="pulse" />
            </span>
            <span className="sample-copy">
              <strong>{example.title}</strong>
              <span>{example.detail}</span>
            </span>
            <span className="radio-mark">
              {analysis?.name === example.fileName ? <Icon name="check" /> : null}
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
        disabled={Boolean(pendingResult)}
        onClick={() => fileInput.current?.click()}
      >
        <span className="upload-icon">
          <Icon name="upload" />
        </span>
        <strong>Choose a JSON file</strong>
        <span>Knee-angle data with a sample rate</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Import session JSON"
        className="sr-only"
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
    </section>
  );
}
