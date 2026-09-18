import { Navigate, useParams } from 'react-router';
import { PageNotice } from '@/components/shared/PageNotice';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { loading } from '@/lib/query';
import { teamPath } from '@/lib/team';

export function WorkspaceIndex() {
  const { slug } = useParams();
  const workspace = useWorkspace(slug);

  if (!slug) {
    return null;
  }

  if (loading(workspace)) {
    return (
      <div
        role="status"
        aria-label="Loading the workspace"
        className="flex min-h-0 flex-1 flex-col"
      >
        <PageHeader />
      </div>
    );
  }

  if (!workspace.data) {
    return null;
  }

  const [firstTeam] = workspace.data.teams;

  if (!firstTeam) {
    return (
      <PageNotice title={workspace.data.name}>
        <p className="text-muted-foreground text-sm">
          This workspace has no teams yet.
        </p>
      </PageNotice>
    );
  }

  return <Navigate to={teamPath(slug, firstTeam.id)} replace />;
}
