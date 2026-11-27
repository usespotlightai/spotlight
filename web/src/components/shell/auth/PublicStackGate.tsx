import type { ReactElement } from 'react';
import { Outlet, useMatch } from 'react-router';

import { useSession } from '@/hooks/api/useSession';
import { useWorkspaces } from '@/hooks/api/useWorkspaces';
import { RUN_CHANGES_URL, TASK_CHANGES_URL } from '@/lib/change-stack-routes';
import { lazyPage } from '@/lib/lazy-page';
import { loading } from '@/lib/query';

const PublicChangeStack = lazyPage(
  () => import('@/routes/PublicChangeStack'),
  (module) => module.PublicChangeStack,
);

export function PublicStackGate(): ReactElement | null {
  const task = useMatch(TASK_CHANGES_URL);
  const run = useMatch(RUN_CHANGES_URL);
  const slug = (task ?? run)?.params.slug;
  const { data: session, isPending } = useSession();
  const signedIn = Boolean(session?.user);
  const workspaces = useWorkspaces(signedIn && slug !== undefined);

  if (slug === undefined) {
    return <Outlet />;
  }

  if (isPending) {
    return null;
  }

  if (!signedIn) {
    return <PublicChangeStack />;
  }

  if (loading(workspaces)) {
    return null;
  }

  const member =
    workspaces.data?.some((workspace) => workspace.slug === slug) ?? true;

  return member ? <Outlet /> : <PublicChangeStack />;
}
