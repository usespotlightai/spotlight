import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { MoveConfigurationDialog } from '@/components/features/settings/MoveConfigurationDialog';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useConfiguration } from '@/hooks/api/useConfiguration';
import { useMembers } from '@/hooks/api/useMembers';
import { useOnboarding } from '@/hooks/api/useOnboarding';
import { useRenameTeam } from '@/hooks/api/useRenameTeam';
import { useWorkspace } from '@/hooks/api/useWorkspace';

const initialsOf = (name: string) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return initials || '?';
};

export function TeamSettings() {
  const { slug, teamId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: members } = useMembers(teamId);
  const { data: configuration } = useConfiguration(teamId);
  const { data: onboarding } = useOnboarding(teamId);
  const rename = useRenameTeam(slug, teamId);

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const [moving, setMoving] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => {
    if (team?.name) {
      setName(team.name);
    }
  }, [team?.name]);

  if (!team) {
    return null;
  }

  const saveName = () => {
    const next = name.trim();
    if (next.length === 0 || next === team.name) {
      setName(team.name);
      return;
    }
    rename.mutate(next, { onError: () => setName(team.name) });
  };

  return (
    <SettingsPage
      title="Settings"
      description="Manage how this team is configured and who has access."
    >
      <SettingsSection title="General">
        <SettingsRow label="Team name" htmlFor="team-name">
          <input
            id="team-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            className="h-8 w-56 rounded-md border-[0.5px] border-border bg-surface px-2.5 text-foreground text-sm outline-none placeholder:text-muted-foreground focus-visible:border-input"
          />
        </SettingsRow>

        <SettingsRow
          label="Configuration repository"
          description={
            configuration?.movingTo
              ? `Moving to ${configuration.movingTo} once its pull request merges.`
              : undefined
          }
        >
          {onboarding?.connectedToGitHub ? (
            <div className="flex items-center gap-2">
              <span className="truncate text-foreground text-sm">
                {configuration?.readsFrom ?? 'Not set'}
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
      </SettingsSection>

      <MoveConfigurationDialog
        open={moving}
        onOpenChange={setMoving}
        slug={slug}
        teamId={teamId}
        owner={onboarding?.repositoryOwner ?? null}
      />

      <SettingsSection title="Members" count={members?.length}>
        {members && members.length > 0 ? (
          members.map((member) => (
            <div
              key={member.id}
              className="flex min-h-12 items-center gap-3 px-4 py-2"
            >
              <Avatar size="sm">
                {member.image && <AvatarImage src={member.image} alt="" />}
                <AvatarFallback>{initialsOf(member.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-foreground text-sm">
                {member.name}
              </span>
            </div>
          ))
        ) : (
          <p className="px-4 py-4 text-muted-foreground text-sm">
            No one is on this team yet.
          </p>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
