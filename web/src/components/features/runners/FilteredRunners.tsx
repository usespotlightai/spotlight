import { RunnerList } from '@/components/features/runners/RunnerList';
import { RunnerListSkeleton } from '@/components/features/runners/RunnerListSkeleton';
import { Notice } from '@/components/shared/Notice';
import { ViewPills } from '@/components/shared/ViewPills';
import {
  type Host,
  hostInFilter,
  type NamedHarness,
  NONE_IN_FILTER,
  type PushPool,
  poolInFilter,
  RUNNER_FILTERS,
  type RunnerFilter,
} from '@/lib/runner';

type FilteredRunnersProps = {
  slug: string;
  filter: RunnerFilter;
  onFilter: (filter: RunnerFilter) => void;
  loading: boolean;
  hosts: readonly Host[];
  pools: readonly PushPool[];
  harnesses: readonly NamedHarness[] | undefined;
  selectable: boolean;
};

export function FilteredRunners({
  slug,
  filter,
  onFilter,
  loading,
  hosts,
  pools,
  harnesses,
  selectable,
}: FilteredRunnersProps) {
  const shownHosts = hosts.filter((host) => hostInFilter(filter, host));
  const shownPools = pools.filter((pool) => poolInFilter(filter, pool));
  const noneShown =
    filter !== 'all' && shownHosts.length === 0 && shownPools.length === 0;

  return (
    <>
      <ViewPills views={RUNNER_FILTERS} current={filter} onChange={onFilter} />

      {loading ? (
        <RunnerListSkeleton />
      ) : noneShown ? (
        <Notice>
          <p className="text-muted-foreground text-sm">
            {NONE_IN_FILTER[filter]}
          </p>
        </Notice>
      ) : (
        <RunnerList
          slug={slug}
          hosts={shownHosts}
          pools={shownPools}
          harnesses={harnesses}
          selectable={selectable}
        />
      )}
    </>
  );
}
