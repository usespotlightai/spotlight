import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { GitHubIntegration } from '@/components/features/integrations/GitHubIntegration';
import { IntegrationCard } from '@/components/features/integrations/IntegrationCard';
import { IntegrationCardSkeleton } from '@/components/features/integrations/IntegrationCardSkeleton';
import { SettingsEmpty } from '@/components/features/settings/SettingsEmpty';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import GithubMark from '@/components/shared/icons/GithubMark';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useConfiguration } from '@/hooks/api/useConfiguration';
import { useGitHub } from '@/hooks/api/useGitHub';
import { failed, loading } from '@/lib/query';

const GRID = 'grid auto-rows-fr gap-3 sm:grid-cols-2';

export function TeamIntegrations() {
  const { slug, teamId } = useParams();
  const github = useGitHub(slug);
  const configuration = useConfiguration(teamId);

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

  if (!teamId) {
    return null;
  }

  const unread = [github, configuration].filter((query) => failed(query));
  const hosts = configuration.data?.integrations ?? [];

  return (
    <SettingsPage
      title="Integrations"
      description="The hosts this team listens to. Connect the ones that link by authorizing."
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

            {github.data ? (
              <div className={GRID}>
                <GitHubIntegration
                  slug={slug}
                  teamId={teamId}
                  installUrl={github.data.installUrl}
                  connected={github.data.connected}
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
            <h2 className="flex h-6 items-center font-medium text-muted-foreground text-xs">
              Hosts
            </h2>

            {loading(configuration) ? (
              <div
                role="status"
                aria-label="Loading the integrations"
                className={GRID}
              >
                <IntegrationCardSkeleton
                  logo={<Skeleton className="mt-px size-5 rounded-full" />}
                  name={<SkeletonLine className="w-20 text-sm" />}
                />
              </div>
            ) : hosts.length === 0 ? (
              <SettingsEmpty>This team listens to no host yet.</SettingsEmpty>
            ) : (
              <div className={GRID}>
                {hosts.map((each) => (
                  <IntegrationCard
                    key={each.source}
                    integration={each}
                    teamId={teamId}
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
