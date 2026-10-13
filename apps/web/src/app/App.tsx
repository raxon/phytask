import { Route, Routes } from 'react-router';
import { AppLayout } from './AppLayout';
import { WorkspacePage } from '../features/workspace/pages/WorkspacePage';
import { HistoryPage } from '../features/sessions/pages/HistoryPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<WorkspacePage />} />
        <Route path="history" element={<HistoryPage />} />
      </Route>
    </Routes>
  );
}
