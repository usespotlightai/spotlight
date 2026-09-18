import { SquareMousePointer } from 'lucide-react';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { ConfigureLink } from '@/components/shared/ConfigureLink';
import { RowIcon } from '@/components/shared/RowIcon';
import type { TeamSkillResponseDto } from '@/lib/api';
import { repositoryFolderUrl } from '@/lib/github';

type TeamSkillRowProps = {
  skill: TeamSkillResponseDto;
  repository: string | null;
};

export function TeamSkillRow({ skill, repository }: TeamSkillRowProps) {
  return (
    <SettingsRow
      label={skill.key}
      description={skill.description}
      leading={<RowIcon icon={SquareMousePointer} />}
    >
      {repository && (
        <ConfigureLink
          href={repositoryFolderUrl(repository, skill.path)}
          name={skill.key}
        />
      )}
    </SettingsRow>
  );
}
