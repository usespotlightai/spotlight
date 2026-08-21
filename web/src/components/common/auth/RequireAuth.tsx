import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '@/hooks/api/useSession';

export function RequireAuth() {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return null;
  }

  if (!session?.user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
