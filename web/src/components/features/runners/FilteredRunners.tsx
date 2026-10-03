import { RunnerList } from '@/components/features/runners/RunnerList';
import { RunnerListSkeleton } from '@/components/features/runners/RunnerListSkeleton';
import { Notice } from '@/components/shared/Notice';
import { ViewPills } from '@/components/shared/ViewPills';
import {
  type Host,
  hostInFilter,
  type NamedHarness,
  NONE_IN_FILTER,
  type ProvisionedRunner,
  provisionedInFilter,
  RUNNER_FILTERS,
  type RunnerFilter,
} from '@/lib/runner';

type FilteredRunnersProps = {
  filter: RunnerFilter;
  onFilter: (filter: RunnerFilter) => void;
  loading: boolean;
  hosts: readonly Host[];
  provisioned: readonly ProvisionedRunner[];
  harnesses: readonly NamedHarness[] | undefined;
};

export function FilteredRunners({
  filter,
  onFilter,
  loading,
  hosts,
  provisioned,
  harnesses,
}: FilteredRunnersProps) {
  const shownHosts = hosts.filter((host) => hostInFilter(filter, host));
  const shownProvisioned = provisioned.filter((runner) =>
    provisionedInFilter(filter, runner),
  );
  const noneShown =
    filter !== 'all' &&
    shownHosts.length === 0 &&
    shownProvisioned.length === 0;

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
          hosts={shownHosts}
          provisioned={shownProvisioned}
          harnesses={harnesses}
        />
      )}
    </>
  );
}
