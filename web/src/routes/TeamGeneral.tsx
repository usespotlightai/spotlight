import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamInvites } from '@/components/features/settings/TeamInvites';
import { TeamMembers } from '@/components/features/settings/TeamMembers';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { useRenameTeam } from '@/hooks/api/useRenameTeam';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { failed } from '@/lib/query';

export function TeamGeneral() {
  const { slug, teamId } = useParams();
  const workspace = useWorkspace(slug);
  const rename = useRenameTeam(slug, teamId);

  const team = workspace.data?.teams.find(
    (candidate) => candidate.id === teamId,
  );

  const [name, setName] = useState('');
  useEffect(() => {
    if (team?.name) {
      setName(team.name);
    }
  }, [team?.name]);

  if (!teamId || (workspace.data !== undefined && !team)) {
    return null;
  }

  const saveName = () => {
    if (!team) {
      return;
    }
    const next = name.trim();
    if (next.length === 0 || next === team.name) {
      setName(team.name);
      return;
    }
    rename.mutate(next, { onError: () => setName(team.name) });
  };

  return (
    <SettingsPage
      title="General"
      description="Manage what this team is called and who has access."
    >
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
          <SettingsRow label="Team name" htmlFor="team-name">
            {team ? (
              <FieldInput
                id="team-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={saveName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
                className="w-72 bg-surface"
              />
            ) : (
              <span
                role="status"
                aria-label="Loading the team name"
                className="flex"
              >
                <Skeleton className="h-8 w-72 rounded-md" />
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
