import { useParams } from 'react-router';
import { ConfigurationRepositoryLink } from '@/components/features/settings/ConfigurationRepositoryLink';
import { SettingsEmpty } from '@/components/features/settings/SettingsEmpty';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamSkillRow } from '@/components/features/skills/TeamSkillRow';
import { TeamSkillRowSkeleton } from '@/components/features/skills/TeamSkillRowSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { useTeamSkills } from '@/hooks/api/useTeamSkills';
import { failed, loading } from '@/lib/query';

export function TeamSkills() {
  const { slug, teamId } = useParams();
  const skills = useTeamSkills(teamId);

  if (!teamId) {
    return null;
  }

  const repository = skills.data?.repository ?? null;
  const held = skills.data?.skills ?? [];

  return (
    <SettingsPage
      title="Skills"
      description="Reusable instructions and context for your agents. Each skill is a folder under .spotlight/skills containing a SKILL.md, and is available to any station that references it."
    >
      {loading(skills) && (
        <SettingsSection>
          <div role="status" aria-label="Loading the skills">
            <TeamSkillRowSkeleton />
          </div>
        </SettingsSection>
      )}

      {failed(skills) && (
        <SettingsSection>
          <CouldNotLoad
            what="Skills"
            retrying={skills.isFetching}
            onRetry={() => void skills.refetch()}
            className="items-start px-4 py-3"
          />
        </SettingsSection>
      )}

      {skills.data?.skills.length === 0 && (
        <SettingsEmpty
          action={
            <ConfigurationRepositoryLink
              slug={slug}
              teamId={teamId}
              repository={repository}
            />
          }
        >
          No skills yet. Add a folder with a SKILL.md under .spotlight/skills
          {repository ? ` in ${repository}` : ''}.
        </SettingsEmpty>
      )}

      {held.length > 0 && (
        <SettingsSection>
          {held.map((skill) => (
            <TeamSkillRow
              key={skill.key}
              skill={skill}
              repository={repository}
            />
          ))}
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
