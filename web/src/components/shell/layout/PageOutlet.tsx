import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { PageErrorBoundary } from '@/components/shell/layout/PageErrorBoundary';

type PageOutletProps = {
  what?: string;
  centered?: boolean;
};

export function PageOutlet({ what, centered }: PageOutletProps) {
  return (
    <PageErrorBoundary what={what} centered={centered}>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </PageErrorBoundary>
  );
}
