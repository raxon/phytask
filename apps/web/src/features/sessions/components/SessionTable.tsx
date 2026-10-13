import type { SessionResult } from '@rep-counter/contracts/session';
import { Icon } from '../../../shared/ui/Icon';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function SessionTable({ sessions }: { sessions: readonly SessionResult[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Performed at</th>
            <th>Exercise</th>
            <th>Reps</th>
            <th>Duration</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.sessionId}>
              <td>
                <span className="date-cell">
                  {dateFormatter.format(new Date(session.performedAt))}
                </span>
                <span className="session-id">{session.sessionId.slice(0, 8)}</span>
              </td>
              <td>
                <span className="exercise-label">
                  <span className="exercise-icon">
                    <Icon name="pulse" />
                  </span>
                  Squats
                </span>
              </td>
              <td>
                <strong className="table-reps">{session.reps}</strong>
              </td>
              <td className="duration-cell">{session.durationSec.toFixed(1)}s</td>
              <td>
                <span className="saved-pill">
                  <Icon name="check" />
                  Saved
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
