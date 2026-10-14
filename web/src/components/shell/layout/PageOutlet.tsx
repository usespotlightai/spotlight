import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { PageErrorBoundary } from '@/components/shell/layout/PageErrorBoundary';

export function PageOutlet() {
  return (
    <PageErrorBoundary>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </PageErrorBoundary>
  );
}
