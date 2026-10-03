import { Server } from 'lucide-react';
import { useParams } from 'react-router';
import { AddHostLink } from '@/components/features/runners/AddHostLink';
import { HostHead } from '@/components/features/runners/HostHead';
import { HostRow } from '@/components/features/runners/HostRow';
import { HostRowSkeleton } from '@/components/features/runners/HostRowSkeleton';
import { ProvisionedHead } from '@/components/features/runners/ProvisionedHead';
import { ProvisionedRunnerRow } from '@/components/features/runners/ProvisionedRunnerRow';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import { ViewPills } from '@/components/shared/ViewPills';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRunners } from '@/hooks/api/useRunners';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useRemembered } from '@/hooks/useRemembered';
import { failed, loading } from '@/lib/query';
import { managesRunners } from '@/lib/role';
import {
  asRunnerFilter,
  FALLBACK_RUNNER_FILTER,
  harnessesOf,
  hostInFilter,
  NONE_IN_FILTER,
  provisionedInFilter,
  RUNNER_FILTERS,
} from '@/lib/runner';
import { TrailContext, useTrail } from '@/lib/trail';

const FILTER_KEY = 'spotlight.runner-filter';

export function Runners() {
  const { slug } = useParams();
  const fleet = useRunners(slug);
  const { data: harnesses } = useHarnesses();
  const { data: workspace } = useWorkspace(slug);
  const [held, remember] = useRemembered(FILTER_KEY, FALLBACK_RUNNER_FILTER);
  const filter = asRunnerFilter(held);
  const { trail, forward } = useTrail([{ label: 'Runners' }]);

  if (!slug) {
    return null;
  }

  const adds = workspace ? managesRunners(workspace.role) : false;
  const hosts = fleet.data?.hosts;
  const provisioned = fleet.data?.provisioned ?? [];
  const shownHosts = (hosts ?? []).filter((host) => hostInFilter(filter, host));
  const shownProvisioned = provisioned.filter((runner) =>
    provisionedInFilter(filter, runner),
  );

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
      ) : hosts?.length === 0 && provisioned.length === 0 ? (
        <Notice>
          <EmptyState
            icon={Server}
            title="No hosts yet"
            action={
              adds && <AddHostLink slug={slug} label="Add the first host" />
            }
          >
            {adds
              ? 'A host starts a fresh runner for each run.'
              : 'A workspace owner or admin can add one.'}
          </EmptyState>
        </Notice>
      ) : (
        <>
          <ViewPills
            views={RUNNER_FILTERS}
            current={filter}
            onChange={remember}
          />

          {loading(fleet) ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
              <HostHead />

              <ul role="status" aria-label="Loading the hosts">
                <HostRowSkeleton />
              </ul>
            </div>
          ) : filter !== 'all' &&
            shownHosts.length === 0 &&
            shownProvisioned.length === 0 ? (
            <Notice>
              <p className="text-muted-foreground text-sm">
                {NONE_IN_FILTER[filter]}
              </p>
            </Notice>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1.5 pb-1.5">
              {shownHosts.length > 0 && (
                <section aria-label="Hosts">
                  <HostHead />

                  <ul className="flex flex-col">
                    {shownHosts.map((host) => (
                      <HostRow
                        key={host.id}
                        host={host}
                        harnesses={harnesses}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {shownProvisioned.length > 0 && (
                <section aria-label="Provisioned by a pool">
                  <ProvisionedHead />

                  <ul className="flex flex-col">
                    {shownProvisioned.map((runner) => (
                      <ProvisionedRunnerRow
                        key={runner.id}
                        runner={runner}
                        harnesses={harnessesOf(runner.harnesses, harnesses)}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </TrailContext>
  );
}
