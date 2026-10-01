import { SquareMousePointer } from 'lucide-react';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
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
        description={skill.description}
        leading={<RowIcon icon={SquareMousePointer} />}
      >
        <span className="truncate font-mono text-muted-foreground text-xs">
          {skill.path}
        </span>
      </SettingsRow>
    </div>
  );
}
