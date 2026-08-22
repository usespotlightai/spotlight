import { Navigate } from 'react-router';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';
import { workspacePath } from '@/lib/workspace';

export function DefaultWorkspace() {
  const { data: workspaces, isPending } = useWorkspaces();

  if (isPending) {
    return null;
  }

  const [first] = workspaces ?? [];

  return first ? (
    <Navigate to={workspacePath(first.slug)} replace />
  ) : (
    <Navigate to="/workspaces/new" replace />
  );
}
