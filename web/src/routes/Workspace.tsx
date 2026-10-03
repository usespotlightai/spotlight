import { Link, useMatch, useParams } from 'react-router';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { DashboardLayout } from '@/components/shell/layout/DashboardLayout';
import { PageOutlet } from '@/components/shell/layout/PageOutlet';
import { SettingsSidebar } from '@/components/shell/layout/SettingsSidebar';
import { WorkspaceSidebar } from '@/components/shell/layout/WorkspaceSidebar';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useLastPlace } from '@/hooks/useLastPlace';
import { failed, loading } from '@/lib/query';
import { WORKSPACE_URL_PREFIX, workspacePath } from '@/lib/workspace';

export function Workspace() {
  const { slug } = useParams();
  const workspace = useWorkspace(slug);
  const inSettings = Boolean(useMatch('/w/:slug/settings/*'));
  const leftAt = useLastPlace(!inSettings);

  if (!slug) {
    return null;
  }

  if (loading(workspace)) {
    return (
      <DashboardLayout>
        <PageOutlet />
      </DashboardLayout>
    );
  }

  if (failed(workspace)) {
    return (
      <DashboardLayout>
        <PageNotice>
          <CouldNotLoad
            what="The workspace"
            retrying={workspace.isFetching}
            onRetry={() => void workspace.refetch()}
          />
        </PageNotice>
      </DashboardLayout>
    );
  }

  if (!workspace.data) {
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
      sidebar={
        inSettings ? (
          <SettingsSidebar
            slug={slug}
            back={leftAt ?? workspacePath(slug)}
            workspace={workspace.data}
          />
        ) : (
          <WorkspaceSidebar slug={slug} workspace={workspace.data} />
        )
      }
    >
      <PageOutlet />
    </DashboardLayout>
  );
}
