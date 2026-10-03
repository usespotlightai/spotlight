import { Navigate, useParams } from 'react-router';
import { AddHostSteps } from '@/components/features/runners/AddHostSteps';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { managesRunners } from '@/lib/role';
import { runnersPath } from '@/lib/runner';
import { useTrail } from '@/lib/trail';

export function AddHost() {
  const { slug } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const base: BreadcrumbSegment[] = [
    ...(slug ? [{ label: 'Runners', to: runnersPath(slug) }] : []),
    { label: 'Add a host' },
  ];
  const { trail } = useTrail(base);

  if (!slug) {
    return null;
  }

  if (workspace && !managesRunners(workspace.role)) {
    return <Navigate to={runnersPath(slug)} replace />;
  }

  return (
    <>
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <SettingsPage
        title="Add a host"
        description="A host is a machine of yours that runs agents for this workspace. Put it in a pool, run one command on it, and it shows up here once it connects."
      >
        {workspace && <AddHostSteps slug={slug} workspaceId={workspace.id} />}
      </SettingsPage>
    </>
  );
}
