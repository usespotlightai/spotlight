import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '@/hooks/api/useSession';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';

const CREATE_WORKSPACE = '/workspaces/new';

export function RequireAuth() {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  const signedIn = Boolean(session?.user);
  const workspaces = useWorkspaces(signedIn);

  if (isPending) {
    return null;
  }

  if (!signedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (workspaces.isPending) {
    return null;
  }

  if (workspaces.data?.length === 0 && location.pathname !== CREATE_WORKSPACE) {
    return <Navigate to={CREATE_WORKSPACE} replace />;
  }

  return <Outlet />;
}
