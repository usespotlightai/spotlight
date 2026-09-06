import { Navigate, useParams } from 'react-router';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { teamPath } from '@/lib/team';

export function WorkspaceIndex() {
  const { slug } = useParams();
  const { data: workspace } = useWorkspace(slug);

  if (!workspace || !slug) {
    return null;
  }

  const [firstTeam] = workspace.teams;

  if (!firstTeam) {
    return (
      <>
        <PageHeader title={workspace.name} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">
            This workspace has no teams yet.
          </p>
        </div>
      </>
    );
  }

  return <Navigate to={teamPath(slug, firstTeam.id)} replace />;
}
