import { useLocation, useParams } from 'react-router';
import { SettingsEmpty } from '@/components/features/settings/SettingsEmpty';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { TeamSkillRow } from '@/components/features/skills/TeamSkillRow';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import { useTeamSkills } from '@/hooks/api/useTeamSkills';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { failed, loading } from '@/lib/query';
import { pointedSkill } from '@/lib/skills';

export function TeamSkills() {
  const { teamId } = useParams();
  const skills = useTeamSkills(teamId);
  const { hash } = useLocation();
  const pointed = pointedSkill(hash);

  useScrollToHash(Boolean(skills.data));

  if (!teamId) {
    return null;
  }

  const held = skills.data?.skills ?? [];

  return (
    <SettingsPage
      title="Skills"
      description="Skill: reusable instructions and context for agents. Any station can reference one."
    >
      {loading(skills) && (
        <SettingsSection>
          <div role="status" aria-label="Loading the skills">
            <IconRowSkeleton nameWidth="w-28" aboutWidth="w-48" />
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
        <SettingsEmpty>No skills defined for this team.</SettingsEmpty>
      )}

      {held.length > 0 && (
        <SettingsSection>
          {held.map((skill) => (
            <TeamSkillRow
              key={skill.key}
              skill={skill}
              pointed={skill.key === pointed}
            />
          ))}
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
