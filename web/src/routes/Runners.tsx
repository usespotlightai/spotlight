import { useParams } from 'react-router';
import { HostCard } from '@/components/features/runners/HostCard';
import { HostCardSkeleton } from '@/components/features/runners/HostCardSkeleton';
import { HostInstall } from '@/components/features/runners/HostInstall';
import { ProvisionedRunnerCard } from '@/components/features/runners/ProvisionedRunnerCard';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useRunners } from '@/hooks/api/useRunners';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { failed, loading } from '@/lib/query';
import { harnessesOf } from '@/lib/runner';

const FLEET = 'grid gap-2 sm:grid-cols-2';

const HEADING =
  'flex h-6 items-center font-medium text-muted-foreground text-xs';

export function Runners() {
  const { slug } = useParams();
  const fleet = useRunners(slug);
  const { data: harnesses } = useHarnesses();
  const workspaceQuery = useWorkspace(slug);
  const workspace = workspaceQuery.data;

  if (!slug) {
    return null;
  }

  const hosts = fleet.data?.hosts ?? [];
  const provisioned = fleet.data?.provisioned ?? [];

  return (
    <>
      <PageHeader title={<Breadcrumbs segments={[{ label: 'Runners' }]} />} />

      <SettingsPage
        title="Runners"
        description="Every run gets a fresh runner. Hosts start them, one sandbox per run, from the runner images a line names or their default; a run only goes where its image and harness are."
      >
        <section className="flex flex-col gap-2">
          <h2 className={HEADING}>Hosts</h2>

          {(loading(fleet) ||
            (hosts.length === 0 && loading(workspaceQuery))) && (
            <ul role="status" aria-label="Loading the hosts" className={FLEET}>
              <HostCardSkeleton />
            </ul>
          )}

          {failed(fleet) && (
            <CouldNotLoad
              what="Runners"
              retrying={fleet.isFetching}
              onRetry={() => void fleet.refetch()}
              className="items-start"
            />
          )}

          {fleet.data && workspace && hosts.length === 0 && (
            <HostInstall workspace={workspace} />
          )}

          {hosts.length > 0 && (
            <ul className={FLEET}>
              {hosts.map((host) => (
                <HostCard key={host.id} host={host} harnesses={harnesses} />
              ))}
            </ul>
          )}
        </section>

        {provisioned.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className={HEADING}>Provisioned by a pool</h2>

            <ul className={FLEET}>
              {provisioned.map((runner) => (
                <ProvisionedRunnerCard
                  key={runner.id}
                  runner={runner}
                  harnesses={harnessesOf(runner.harnesses, harnesses)}
                />
              ))}
            </ul>
          </section>
        )}
      </SettingsPage>
    </>
  );
}
