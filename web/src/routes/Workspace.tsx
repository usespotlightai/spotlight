import { Link, useParams } from 'react-router';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { WORKSPACE_URL_PREFIX } from '@/lib/workspace';

export function Workspace() {
  const { slug } = useParams();
  const { data: workspace, isPending } = useWorkspace(slug);

  if (isPending) {
    return null;
  }

  if (!workspace) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
        <h1 className="font-medium text-2xl tracking-tight">
          Workspace not found
        </h1>
        <p className="max-w-sm text-center text-muted-foreground text-sm">
          There is no workspace at {WORKSPACE_URL_PREFIX}
          {slug}, or you are not a member of it.
        </p>
        <Link
          to="/workspaces/new"
          className="font-[450] text-foreground text-sm hover:underline"
        >
          Create a workspace
        </Link>
      </main>
    );
  }

  return (
    <DashboardLayout
      title={workspace.name}
      sidebar={
        <div className="flex h-full flex-col gap-1">
          <div className="flex h-12 shrink-0 items-center px-2">
            <p className="truncate font-medium text-foreground text-sm">
              {workspace.name}
            </p>
          </div>
        </div>
      }
    />
  );
}
