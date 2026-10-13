import { patients, type PatientId } from '@rep-counter/demo-data/patients';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { actions } from '../../workspace/model/workspace-slice';

export function PatientPicker() {
  const dispatch = useAppDispatch();
  const patientId = useAppSelector((state) => state.workspace.patientId);
  const sessionActive = useAppSelector(
    (state) =>
      state.workspace.streamStatus === 'running' || state.workspace.streamStatus === 'interrupted',
  );
  const patient = patients[patientId];
  return (
    <div className="patient-picker">
      <span className="avatar">{patient.initials}</span>
      <div>
        <label htmlFor="patient">DEMO PATIENT</label>
        <select
          id="patient"
          value={patientId}
          disabled={sessionActive}
          title={
            sessionActive ? 'Finish the active session before changing the patient.' : undefined
          }
          onChange={(event) => dispatch(actions.selectPatient(event.target.value as PatientId))}
        >
          <option value="alex">Alex Morgan</option>
          <option value="jamie">Jamie Taylor</option>
        </select>
      </div>
    </div>
  );
}
