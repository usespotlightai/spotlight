import { SquareMousePointer } from 'lucide-react';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { OneLine } from '@/components/shared/OneLine';
import { RowIcon } from '@/components/shared/RowIcon';
import type { TeamSkillResponseDto } from '@/lib/api';
import { skillAnchor } from '@/lib/skills';
import { cn } from '@/lib/utils';

export function TeamSkillRow({
  skill,
  pointed = false,
}: {
  skill: TeamSkillResponseDto;
  pointed?: boolean;
}) {
  return (
    <div
      id={skillAnchor(skill.key)}
      data-slot="team-skill"
      data-pointed={pointed || undefined}
      className={cn('scroll-mt-4 transition-colors', pointed && 'bg-accent')}
    >
      <SettingsRow
        label={skill.key}
        description={
          skill.description ? <OneLine text={skill.description} /> : undefined
        }
        leading={<RowIcon icon={SquareMousePointer} />}
      />
    </div>
  );
}
