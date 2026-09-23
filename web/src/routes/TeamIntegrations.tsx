import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { GitHubIntegration } from '@/components/features/integrations/GitHubIntegration';
import { IntegrationCard } from '@/components/features/integrations/IntegrationCard';
import { IntegrationCardSkeleton } from '@/components/features/integrations/IntegrationCardSkeleton';
import { ConfigurationRepositoryLink } from '@/components/features/settings/ConfigurationRepositoryLink';
import { SettingsEmpty } from '@/components/features/settings/SettingsEmpty';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import GithubMark from '@/components/shared/icons/GithubMark';
import { ProposedPullRequest } from '@/components/shared/ProposedPullRequest';
import { RereadConfigurationButton } from '@/components/shared/RereadConfigurationButton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { Button } from '@/components/ui/button';
import { useConfiguration } from '@/hooks/api/useConfiguration';
import {
  useChooseIntegrations,
  useOnboarding,
} from '@/hooks/api/useOnboarding';
import { messageOf } from '@/lib/error';
import { shownTogether } from '@/lib/integrations';
import { failed, loading } from '@/lib/query';

const GRID = 'grid auto-rows-fr gap-3 sm:grid-cols-2';
const HOST_NAMES = ['w-20', 'w-28', 'w-16', 'w-24'];

export function TeamIntegrations() {
  const { slug, teamId } = useParams();
  const onboarding = useOnboarding(teamId);
  const configuration = useConfiguration(teamId);
  const choose = useChooseIntegrations(teamId);

  const [params, setParams] = useSearchParams();
  const connected = params.get('connected');
  useEffect(() => {
    if (!connected) {
      return;
    }
    setParams(
      (held) => {
        held.delete('connected');
        return held;
      },
      { replace: true },
    );
  }, [connected, setParams]);

  const [wanted, setWanted] = useState<ReadonlyMap<string, boolean>>(new Map());

  if (!teamId) {
    return null;
  }

  const unread = [onboarding, configuration].filter((query) => failed(query));
  const pending = loading(onboarding) || loading(configuration);

  const shown = shownTogether(
    onboarding.data?.integrations ?? [],
    configuration.data?.integrations ?? [],
  );

  const listening = (source: string) =>
    shown.some((each) => each.source === source && each.integration !== null);

  const selected = (source: string) => wanted.get(source) ?? listening(source);

  const toggle = (source: string) =>
    setWanted((held) => {
      const next = new Map(held);
      next.set(source, !selected(source));
      return next;
    });

  const asked = [...wanted].filter(([source, on]) => on !== listening(source));
  const sources = asked.filter(([, on]) => on).map(([source]) => source);
  const dropped = asked.filter(([, on]) => !on).map(([source]) => source);
  const changed = sources.length + dropped.length;

  const notOpened = choose.error
    ? messageOf(choose.error, 'The pull request could not be opened.')
    : null;

  return (
    <SettingsPage
      title="Integrations"
      description="The hosts this team listens to, written as files in its configuration repository. Push a change and Spotlight reads it again."
    >
      {unread.length > 0 ? (
        <SettingsSection>
          <CouldNotLoad
            what="Integrations"
            retrying={unread.some((query) => query.isFetching)}
            onRetry={() => {
              for (const query of unread) {
                void query.refetch();
              }
            }}
            className="items-start px-4 py-3"
          />
        </SettingsSection>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
              GitHub
            </h2>

            {onboarding.data ? (
              <div className={GRID}>
                <GitHubIntegration
                  slug={slug}
                  teamId={teamId}
                  installUrl={onboarding.data.installUrl}
                  connected={onboarding.data.connectedToGitHub}
                  repository={onboarding.data.configRepository}
                />
              </div>
            ) : (
              <div role="status" aria-label="Loading GitHub" className={GRID}>
                <IntegrationCardSkeleton
                  logo={
                    <GithubMark
                      className="mt-px size-5 shrink-0 text-foreground"
                      aria-hidden
                    />
                  }
                  name={
                    <h3 className="font-medium text-foreground text-sm">
                      GitHub
                    </h3>
                  }
                />
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
                Hosts
              </h2>

              <div className="flex items-center gap-2">
                <RereadConfigurationButton teamId={teamId} />

                <Button
                  size="sm"
                  disabled={changed === 0 || choose.isPending}
                  onClick={() => choose.mutate({ sources, dropped })}
                  className="rounded-full shadow-none"
                >
                  {choose.isPending ? 'Opening…' : 'Open pull request'}
                </Button>
              </div>
            </div>

            {notOpened && (
              <p className="text-destructive text-sm">{notOpened}</p>
            )}

            {choose.data?.url && (
              <ProposedPullRequest url={choose.data.url}>
                Merge the pull request to apply the change.
              </ProposedPullRequest>
            )}

            {loading(configuration) && (
              <p className="flex items-center gap-1 text-muted-foreground text-xs">
                Read from
                <SkeletonLine className="w-40" />
                at
                <SkeletonLine className="w-12" />
              </p>
            )}

            {configuration.data?.repository && (
              <p className="text-muted-foreground text-xs">
                Read from{' '}
                <span className="text-foreground">
                  {configuration.data.repository}
                </span>{' '}
                at{' '}
                <span className="text-foreground">
                  {configuration.data.sha?.slice(0, 7)}
                </span>
              </p>
            )}

            {pending ? (
              <div
                role="status"
                aria-label="Loading the integrations"
                className={GRID}
              >
                {HOST_NAMES.map((width) => (
                  <IntegrationCardSkeleton
                    key={width}
                    logo={<Skeleton className="mt-px size-5 rounded-full" />}
                    name={<SkeletonLine className={`${width} text-sm`} />}
                  >
                    <Skeleton className="mt-0.5 size-3.5 rounded-[4px]" />
                  </IntegrationCardSkeleton>
                ))}
              </div>
            ) : shown.length === 0 ? (
              <SettingsEmpty
                action={
                  <ConfigurationRepositoryLink
                    slug={slug}
                    teamId={teamId}
                    repository={configuration.data?.repository ?? null}
                  />
                }
              >
                No integrations yet. Write one under .spotlight/integrations in
                the configuration repository, then read it again.
              </SettingsEmpty>
            ) : (
              <div className={GRID}>
                {shown.map((each) => (
                  <IntegrationCard
                    key={each.source}
                    shown={each}
                    teamId={teamId}
                    repository={configuration.data?.repository ?? null}
                    selected={selected(each.source)}
                    onToggle={() => toggle(each.source)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </SettingsPage>
  );
}
