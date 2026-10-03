import { Suspense } from 'react';
import { Outlet } from 'react-router';

export function PageOutlet() {
  return (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );
}
