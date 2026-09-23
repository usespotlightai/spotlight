import { useParams } from 'react-router';
import { SettingsEmpty } from '@/components/features/settings/SettingsEmpty';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamSkillRow } from '@/components/features/skills/TeamSkillRow';
import { TeamSkillRowSkeleton } from '@/components/features/skills/TeamSkillRowSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { useTeamSkills } from '@/hooks/api/useTeamSkills';
import { failed, loading } from '@/lib/query';

export function TeamSkills() {
  const { teamId } = useParams();
  const skills = useTeamSkills(teamId);

  if (!teamId) {
    return null;
  }

  const held = skills.data?.skills ?? [];

  return (
    <SettingsPage
      title="Skills"
      description="Reusable instructions and context for your agents, available to any station that references them."
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
        <SettingsEmpty>This team defines no skills yet.</SettingsEmpty>
      )}

      {held.length > 0 && (
        <SettingsSection>
          {held.map((skill) => (
            <TeamSkillRow key={skill.key} skill={skill} />
          ))}
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
