import { Suspense, useEffect } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router';
import { AppHeader } from './AppHeader';
import { PageLoading } from './PageLoading';
import { PatientPicker } from '../features/patients/components/PatientPicker';

export function AppLayout() {
  const isHistory = Boolean(useMatch('/history'));
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = isHistory
      ? 'Rep Counter - Session history'
      : 'Rep Counter - Session workspace';
    window.scrollTo(0, 0);
  }, [isHistory]);

  return (
    <>
      <a href="#main" className="skip-link">
        {isHistory ? 'Skip to session history' : 'Skip to workspace'}
      </a>
      <AppHeader />
      <main id="main" className="mx-auto max-w-[1184px] px-5 pb-12 pt-9 sm:px-8 sm:pt-12">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {isHistory ? 'YOUR PROGRESS, KEPT TOGETHER' : 'MOVEMENT ANALYSIS'}
            </p>
            <h1>
              {isHistory ? 'Session history' : 'Every rep counts'}
              <span>.</span>
            </h1>
          </div>
          <PatientPicker />
        </div>
        <Suspense
          key={pathname}
          fallback={<PageLoading page={isHistory ? 'session history' : 'workspace'} />}
        >
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
