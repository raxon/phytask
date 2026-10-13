import { useAppSelector } from '../../../app/hooks';
import { workspaceCommands } from '../../../app/bootstrap';
import { selectWorkspaceView } from '../model/selectors';

export function useWorkspace() {
  const view = useAppSelector((state) => selectWorkspaceView(state.workspace));
  return { view, commands: workspaceCommands };
}
