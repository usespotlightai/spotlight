import { Link2 } from 'lucide-react';
import { useParams } from 'react-router';
import { ConnectionRow } from '@/components/features/connections/ConnectionRow';
import { ConnectionRowSkeleton } from '@/components/features/connections/ConnectionRowSkeleton';
import { ConnectionsRoster } from '@/components/features/connections/ConnectionsRoster';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { PillLink } from '@/components/shared/PillLink';
import { useConfiguration } from '@/hooks/api/useConfiguration';
import { useConnections } from '@/hooks/api/useConnections';
import { useClearedParam } from '@/hooks/useClearedParam';
import { failed, loading } from '@/lib/query';
import { teamSettingsPath } from '@/lib/settings';

export function TeamConnections() {
  const { slug, teamId } = useParams();
  const configuration = useConfiguration(teamId);
  const connections = useConnections(teamId);

  useClearedParam('connected');

  if (!slug || !teamId) {
    return null;
  }

  const unread = [configuration, connections].filter((query) => failed(query));
  const personal = (configuration.data?.integrations ?? []).filter(
    (each) => each.holding === 'requester',
  );
  const mine = new Map(
    (connections.data?.mine ?? []).map((each) => [each.source, each]),
  );
  const people = connections.data?.people ?? null;

  return (
    <SettingsPage
      title="Connections"
      description="Some integrations act as the person who started a task. Connect your own account to each of them, so what agents do there shows as you."
    >
      {unread.length > 0 ? (
        <SettingsSection>
          <CouldNotLoad
            what="Connections"
            retrying={unread.some((query) => query.isFetching)}
            onRetry={() => {
              for (const query of unread) {
                void query.refetch();
              }
            }}
            className="items-start px-4 py-3"
          />
        </SettingsSection>
      ) : loading(configuration) || loading(connections) ? (
        <SettingsSection title="Yours">
          <div role="status" aria-label="Loading the connections">
            <ConnectionRowSkeleton />
            <ConnectionRowSkeleton />
          </div>
        </SettingsSection>
      ) : personal.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No integration here acts as each person"
          className="mx-auto py-12"
          action={
            <PillLink to={teamSettingsPath(slug, teamId, 'integrations')}>
              See the integrations
            </PillLink>
          }
        >
          An integration set to act as whoever started a task shows here, for
          each person to connect.
        </EmptyState>
      ) : (
        <>
          <SettingsSection title="Yours">
            {personal.map((each) => (
              <ConnectionRow
                key={each.source}
                integration={each}
                mine={mine.get(each.source) ?? null}
                teamId={teamId}
              />
            ))}
          </SettingsSection>

          {people && (
            <ConnectionsRoster people={people} integrations={personal} />
          )}
        </>
      )}
    </SettingsPage>
  );
}
