import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { CollapsibleRows } from '@/components/shared/nested-table/CollapsibleRows';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { NestedGroupRow } from '@/components/shared/nested-table/NestedGroupRow';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { Collapsibles } from '@/hooks/useCollapsibles';
import { UNUSED_SKILLS_NOTE, UNUSED_TITLE } from '@/lib/insights-tools';
import { skillPath } from '@/lib/skills';
import { cn } from '@/lib/utils';

const UNUSED_KEY = 'unused-skills';

type UnusedSkillsProps = {
  slug: string;
  teamId: string;
  unused: readonly string[];
  collapsibles: Collapsibles;
};

export function UnusedSkills({
  slug,
  teamId,
  unused,
  collapsibles,
}: UnusedSkillsProps) {
  const open = collapsibles.isOpen(UNUSED_KEY);

  return (
    <>
      <NestedGroupRow
        label={UNUSED_TITLE}
        open={open}
        depth={0}
        onToggle={() => collapsibles.toggle(UNUSED_KEY)}
        spans="@4xl:col-span-full"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">{UNUSED_TITLE}</span>
          <span className="text-muted-foreground tabular-nums">
            {unused.length}
          </span>
          <InfoTooltip tooltip={UNUSED_SKILLS_NOTE} />
        </span>
      </NestedGroupRow>

      <CollapsibleRows open={open} label="Unused skills">
        {unused.map((key) => (
          <li
            key={key}
            data-slot="unused-skill"
            className={cn(
              'relative col-span-full py-2 pr-2',
              OUTER_INDENT,
              OUTER_GUIDE,
              OUTER_DIVIDER,
            )}
          >
            <TrailLink
              to={skillPath(slug, teamId, key)}
              className="text-foreground hover:underline"
            >
              {key}
            </TrailLink>
          </li>
        ))}
      </CollapsibleRows>
    </>
  );
}
