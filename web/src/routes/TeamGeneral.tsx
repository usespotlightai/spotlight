import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { VaultKeyField } from '@/components/features/secrets/VaultKeyField';
import { MoveConfigurationDialog } from '@/components/features/settings/MoveConfigurationDialog';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamInvites } from '@/components/features/settings/TeamInvites';
import { TeamMembers } from '@/components/features/settings/TeamMembers';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useConfiguration } from '@/hooks/api/useConfiguration';
import { useOnboarding } from '@/hooks/api/useOnboarding';
import { useRenameTeam } from '@/hooks/api/useRenameTeam';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { failed, loading } from '@/lib/query';

export function TeamGeneral() {
  const { slug, teamId } = useParams();
  const workspace = useWorkspace(slug);
  const configuration = useConfiguration(teamId);
  const onboarding = useOnboarding(teamId);
  const rename = useRenameTeam(slug, teamId);

  const team = workspace.data?.teams.find(
    (candidate) => candidate.id === teamId,
  );

  const [moving, setMoving] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => {
    if (team?.name) {
      setName(team.name);
    }
  }, [team?.name]);

  if (!teamId || (workspace.data !== undefined && !team)) {
    return null;
  }

  const unread = [configuration, onboarding].filter((query) => failed(query));

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
      description="Manage how this team is configured and who has access."
    >
      {unread.length > 0 ? (
        <SettingsSection>
          <CouldNotLoad
            what="The team’s settings"
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

          <SettingsRow
            label="Configuration repository"
            description={
              configuration.data?.movingTo
                ? `Moving to ${configuration.data.movingTo} once its pull request merges.`
                : undefined
            }
          >
            {loading(configuration) || loading(onboarding) ? (
              <span
                role="status"
                aria-label="Loading the configuration repository"
                className="flex"
              >
                <SkeletonLine className="w-32 text-sm" />
              </span>
            ) : onboarding.data?.connectedToGitHub ? (
              <div className="flex items-center gap-2">
                <span className="truncate text-foreground text-sm">
                  {configuration.data?.readsFrom ?? 'Not set'}
                </span>
                <button
                  type="button"
                  onClick={() => setMoving(true)}
                  aria-label="Move configuration"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border-[0.5px] border-border bg-surface text-muted-foreground outline-none hover:text-foreground focus-visible:border-input"
                >
                  <Pencil className="size-3" aria-hidden />
                </button>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">
                Connect GitHub to choose one.
              </span>
            )}
          </SettingsRow>

          <SettingsRow label="Vault key">
            <VaultKeyField teamId={teamId} />
          </SettingsRow>
        </SettingsSection>
      )}

      <TeamMembers slug={slug} teamId={teamId} />

      <TeamInvites teamId={teamId} />

      <MoveConfigurationDialog
        open={moving}
        onOpenChange={setMoving}
        slug={slug}
        teamId={teamId}
        owner={onboarding.data?.repositoryOwner ?? null}
      />
    </SettingsPage>
  );
}
