import { Navigate } from 'react-router';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';
import { failed, loading } from '@/lib/query';
import { workspacePath } from '@/lib/workspace';

export function DefaultWorkspace() {
  const workspaces = useWorkspaces();

  if (failed(workspaces)) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4">
        <CouldNotLoad
          what="Your workspaces"
          retrying={workspaces.isFetching}
          onRetry={() => void workspaces.refetch()}
        />
      </main>
    );
  }

  if (loading(workspaces)) {
    return null;
  }

  const [first] = workspaces.data ?? [];

  return first ? (
    <Navigate to={workspacePath(first.slug)} replace />
  ) : (
    <Navigate to="/workspaces/new" replace />
  );
}
