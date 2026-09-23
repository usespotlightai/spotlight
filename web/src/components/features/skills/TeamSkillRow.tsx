import { SquareMousePointer } from 'lucide-react';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { RowIcon } from '@/components/shared/RowIcon';
import type { TeamSkillResponseDto } from '@/lib/api';

export function TeamSkillRow({ skill }: { skill: TeamSkillResponseDto }) {
  return (
    <SettingsRow
      label={skill.key}
      description={skill.description}
      leading={<RowIcon icon={SquareMousePointer} />}
    >
      <span className="truncate font-mono text-muted-foreground text-xs">
        {skill.path}
      </span>
    </SettingsRow>
  );
}
