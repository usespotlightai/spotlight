import { useParams } from 'react-router';
import { GitHubRow } from '@/components/features/integrations/GitHubRow';
import { IntegrationRow } from '@/components/features/integrations/IntegrationRow';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import { useConfiguration } from '@/hooks/api/useConfiguration';
import { useConnections } from '@/hooks/api/useConnections';
import { useGitHub } from '@/hooks/api/useGitHub';
import { useMembers } from '@/hooks/api/useMembers';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useClearedParam } from '@/hooks/useClearedParam';
import { actsAsEachPerson, joinedOf } from '@/lib/integration';
import { failed, loading } from '@/lib/query';
import { administers } from '@/lib/role';

export function TeamIntegrations() {
  const { slug, teamId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const github = useGitHub(slug);
  const configuration = useConfiguration(teamId);
  const connections = useConnections(teamId);
  const people = connections.data?.people ?? null;
  const members = useMembers(people ? teamId : undefined);

  useClearedParam('connected');

  if (!slug || !teamId) {
    return null;
  }

  const admin = workspace ? administers(workspace.role) : false;
  const unread = [github, configuration, connections].filter((query) =>
    failed(query),
  );
  const mine = new Map(
    (connections.data?.mine ?? []).map((each) => [each.source, each]),
  );

  return (
    <SettingsPage
      title="Integrations"
      description="The services this team works with, and the accounts agents use in each."
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
      ) : loading(github) || loading(configuration) || loading(connections) ? (
        <SettingsSection>
          <div role="status" aria-label="Loading the integrations">
            <IconRowSkeleton nameWidth="w-20" aboutWidth="w-44" />
            <IconRowSkeleton nameWidth="w-16" aboutWidth="w-36" />
            <IconRowSkeleton nameWidth="w-24" aboutWidth="w-40" />
          </div>
        </SettingsSection>
      ) : (
        <SettingsSection list="Integrations">
          {github.data && (
            <GitHubRow
              slug={slug}
              teamId={teamId}
              installUrl={github.data.installUrl}
              connected={github.data.connected}
            />
          )}

          {(configuration.data?.integrations ?? []).map((each) => (
            <IntegrationRow
              key={each.source}
              integration={each}
              teamId={teamId}
              admin={admin}
              mine={mine.get(each.source) ?? null}
              joined={
                people && members.data && actsAsEachPerson(each)
                  ? joinedOf(each.source, people, members.data)
                  : null
              }
            />
          ))}
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
