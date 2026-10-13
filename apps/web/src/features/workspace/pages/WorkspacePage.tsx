import { patients } from '@rep-counter/demo-data/patients';
import { useWorkspace } from '../hooks/use-workspace';
import { SessionSourcePanel } from '../components/SessionSourcePanel';
import { SessionResultPanel } from '../components/SessionResultPanel';
import { SessionSignalPanel } from '../components/SessionSignalPanel';

export function WorkspacePage() {
  const { view, commands } = useWorkspace();
  return (
    <>
      <div className="workspace-grid" id="analysis">
        <SessionSourcePanel
          view={view}
          onChoose={commands.chooseExample}
          onImport={commands.importFile}
        />
        <SessionResultPanel
          view={view}
          patient={patients[view.patientId]}
          onSave={commands.saveResult}
        />
      </div>
      <SessionSignalPanel analysis={view.analysis} />
    </>
  );
}
