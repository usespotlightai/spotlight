import { useParams } from 'react-router';
import { AddHostLink } from '@/components/features/runners/AddHostLink';
import { FilteredRunners } from '@/components/features/runners/FilteredRunners';
import { NoHostsYet } from '@/components/features/runners/NoHostsYet';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Notice } from '@/components/shared/Notice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRunners } from '@/hooks/api/useRunners';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useRemembered } from '@/hooks/useRemembered';
import { failed, loading } from '@/lib/query';
import { isAdmin } from '@/lib/role';
import { asRunnerFilter, FALLBACK_RUNNER_FILTER } from '@/lib/runner';
import { TrailContext, useTrail } from '@/lib/trail';

const FILTER_KEY = 'spotlight.runner-filter';

export function Runners() {
  const { slug } = useParams();
  const fleet = useRunners(slug);
  const { data: harnesses } = useHarnesses();
  const { data: workspace } = useWorkspace(slug);
  const [remembered, remember] = useRemembered(
    FILTER_KEY,
    FALLBACK_RUNNER_FILTER,
  );
  const { trail, forward } = useTrail([{ label: 'Runners' }]);

  if (!slug) {
    return null;
  }

  const adds = workspace ? isAdmin(workspace.role) : false;
  const hosts = fleet.data?.hosts;
  const pools = fleet.data?.pools ?? [];

  return (
    <TrailContext value={forward}>
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        actions={adds && <AddHostLink slug={slug} />}
      />

      {failed(fleet) ? (
        <Notice>
          <CouldNotLoad
            what="Runners"
            retrying={fleet.isFetching}
            onRetry={() => void fleet.refetch()}
          />
        </Notice>
      ) : hosts?.length === 0 && pools.length === 0 ? (
        <NoHostsYet slug={slug} adds={adds} />
      ) : (
        <FilteredRunners
          slug={slug}
          filter={asRunnerFilter(remembered)}
          onFilter={remember}
          loading={loading(fleet)}
          hosts={hosts ?? []}
          pools={pools}
          harnesses={harnesses}
        />
      )}
    </TrailContext>
  );
}
