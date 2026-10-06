import { useParams } from 'react-router';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamInvites } from '@/components/features/settings/TeamInvites';
import { TeamMembers } from '@/components/features/settings/TeamMembers';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { failed } from '@/lib/query';

export function TeamGeneral() {
  const { slug, teamId } = useParams();
  const workspace = useWorkspace(slug);

  const team = workspace.data?.teams.find(
    (candidate) => candidate.id === teamId,
  );

  if (!teamId || (workspace.data !== undefined && !team)) {
    return null;
  }

  return (
    <SettingsPage title="General" description="Team name and members.">
      {failed(workspace) ? (
        <SettingsSection>
          <CouldNotLoad
            what="The team’s settings"
            retrying={workspace.isFetching}
            onRetry={() => void workspace.refetch()}
            className="items-start px-4 py-3"
          />
        </SettingsSection>
      ) : (
        <SettingsSection>
          <SettingsRow label="Team name">
            {team ? (
              <span className="text-foreground text-sm">{team.name}</span>
            ) : (
              <span
                role="status"
                aria-label="Loading the team name"
                className="flex"
              >
                <SkeletonLine className="w-24 text-sm" />
              </span>
            )}
          </SettingsRow>
        </SettingsSection>
      )}

      <TeamMembers slug={slug} teamId={teamId} />

      <TeamInvites teamId={teamId} />
    </SettingsPage>
  );
}
