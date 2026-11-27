import { SkillRows } from '@/components/features/insights/tools/SkillRows';
import { UnusedSkills } from '@/components/features/insights/tools/UnusedSkills';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useCollapsibles } from '@/hooks/useCollapsibles';
import type { StationNames } from '@/lib/insights';
import {
  readShareMax,
  type SkillReport,
  skillHeadings,
  type TrendRule,
} from '@/lib/insights-tools';

type SkillUseProps = {
  slug: string;
  teamId: string;
  skills: readonly SkillReport[];
  unused: readonly string[];
  teamRuns: number;
  rule: TrendRule;
  names: StationNames;
};

export function SkillUse({
  slug,
  teamId,
  skills,
  unused,
  teamRuns,
  rule,
  names,
}: SkillUseProps) {
  const collapsibles = useCollapsibles();
  const max = readShareMax(skills);

  return (
    <NestedTable label="Skill use" headings={skillHeadings(rule, max)}>
      {skills.map((skill) => (
        <SkillRows
          key={skill.key}
          slug={slug}
          teamId={teamId}
          skill={skill}
          teamRuns={teamRuns}
          max={max}
          names={names}
          collapsibles={collapsibles}
        />
      ))}
      {unused.length > 0 && (
        <UnusedSkills
          slug={slug}
          teamId={teamId}
          unused={unused}
          collapsibles={collapsibles}
        />
      )}
    </NestedTable>
  );
}
