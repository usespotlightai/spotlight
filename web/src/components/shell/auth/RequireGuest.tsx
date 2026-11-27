import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '@/hooks/api/useSession';

const cameFrom = (state: unknown): string | undefined => {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return undefined;
  }

  const { from } = state;
  if (typeof from !== 'object' || from === null || !('pathname' in from)) {
    return undefined;
  }

  return typeof from.pathname === 'string' ? from.pathname : undefined;
};

export function RequireGuest(): ReactElement | null {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return null;
  }

  if (session?.user) {
    return <Navigate to={cameFrom(location.state) ?? '/'} replace />;
  }

  return <Outlet />;
}
