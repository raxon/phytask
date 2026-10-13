import type { AppDispatch } from '../../../app/store';
import { sessionsApi } from '../../sessions/api/sessions-api';
import type { SessionWriter } from '../application/ports';

export function createRtkSessionWriter(dispatch: AppDispatch): SessionWriter {
  return {
    async save(patientId, result) {
      const request = dispatch(sessionsApi.endpoints.saveSession.initiate({ patientId, result }));
      try {
        await request.unwrap();
      } finally {
        request.reset();
      }
    },
  };
}
