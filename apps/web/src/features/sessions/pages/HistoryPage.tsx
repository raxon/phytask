import { useAppSelector } from '../../../app/hooks';
import { Link } from 'react-router';
import { useGetSessionsQuery } from '../api/sessions-api';
import { Icon } from '../../../shared/ui/Icon';
import { patients } from '@rep-counter/demo-data/patients';
import { SessionTable } from '../components/SessionTable';

export function HistoryPage() {
  const patientId = useAppSelector((state) => state.workspace.patientId);
  const patient = patients[patientId];
  const history = useGetSessionsQuery(patientId);
  const sessions = history.currentData ?? [];
  const totalReps = sessions.reduce((sum, session) => sum + session.reps, 0);

  return (
    <section id="history" className="history-section" aria-labelledby="history-title">
      <div className="history-heading">
        <h2 id="history-title">
          Saved sessions <span className="count-badge">{sessions.length}</span>
        </h2>
        <button
          type="button"
          className="text-button"
          onClick={() => history.refetch()}
          disabled={history.isFetching}
        >
          <Icon name="refresh" />
          {history.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div className="panel history-panel">
        {history.isLoading || (history.isFetching && !history.currentData) ? (
          <div className="history-empty" role="status">
            Loading your sessions...
          </div>
        ) : history.isError ? (
          <div className="history-empty" role="alert">
            <p>Your session history could not be loaded.</p>
            <button className="text-button" onClick={() => history.refetch()} type="button">
              Try again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="history-empty">
            <span className="empty-icon">
              <Icon name="clock" />
            </span>
            <h3>Your first session starts here</h3>
            <p>
              Save a result in the{' '}
              <Link to="/" className="inline-link">
                workspace
              </Link>{' '}
              to begin {patient.name.split(' ')[0]}'s history.
            </p>
          </div>
        ) : (
          <>
            <div className="history-summary">
              <span>{patient.name}'s sessions</span>
              <span>
                <strong>{totalReps}</strong> total reps <span className="summary-dot">·</span>{' '}
                <strong>{sessions.length}</strong> sessions
              </span>
            </div>
            <SessionTable sessions={sessions} />
          </>
        )}
      </div>
    </section>
  );
}
