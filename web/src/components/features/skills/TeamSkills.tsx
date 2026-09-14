import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamSkillRow } from '@/components/features/skills/TeamSkillRow';
import { useTeamSkills } from '@/hooks/api/useTeamSkills';

type TeamSkillsProps = {
  teamId: string;
};

export function TeamSkills({ teamId }: TeamSkillsProps) {
  const { data, isPending, isError } = useTeamSkills(teamId);

  if (isPending) {
    return null;
  }

  const repository = data?.repository ?? null;
  const skills = data?.skills ?? [];

  return (
    <SettingsPage
      title="Skills"
      description="Reusable instructions and context for your agents. Each skill is a folder under .spotlight/skills containing a SKILL.md, and is available to any station that references it."
    >
      <SettingsSection>
        {isError && (
          <p className="px-4 py-3 text-muted-foreground text-sm">
            Skills could not be loaded. Try again.
          </p>
        )}

        {!isError && skills.length === 0 && (
          <p className="px-4 py-3 text-muted-foreground text-sm">
            No skills yet. Add a folder with a SKILL.md under .spotlight/skills
            {repository ? ` in ${repository}` : ''}.
          </p>
        )}

        {!isError &&
          skills.map((skill) => (
            <TeamSkillRow
              key={skill.key}
              skill={skill}
              repository={repository}
            />
          ))}
      </SettingsSection>
    </SettingsPage>
  );
}
