import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { AppLayout } from './AppLayout';

// Keep route modules outside the initial bundle and preserve their identity across renders.
const WorkspacePage = lazy(() =>
  import('../features/workspace/pages/WorkspacePage').then((module) => ({
    default: module.WorkspacePage,
  })),
);
const HistoryPage = lazy(() =>
  import('../features/sessions/pages/HistoryPage').then((module) => ({
    default: module.HistoryPage,
  })),
);

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
