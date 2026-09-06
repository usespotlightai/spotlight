import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '@/hooks/api/useSession';

export function RequireGuest() {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return null;
  }

  if (session?.user) {
    const from = (location.state as { from?: { pathname?: string } } | null)
      ?.from?.pathname;
    return <Navigate to={from ?? '/'} replace />;
  }

  return <Outlet />;
}
