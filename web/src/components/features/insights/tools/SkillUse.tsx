import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { SkillRows } from '@/components/features/insights/tools/SkillRows';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useCollapsibles } from '@/hooks/useCollapsibles';
import type { StationNames } from '@/lib/insights';
import {
  type SkillReport,
  skillHeadings,
  type TrendRule,
} from '@/lib/insights-tools';

type SkillUseProps = {
  slug: string;
  teamId: string;
  skills: readonly SkillReport[];
  rule: TrendRule;
  names: StationNames;
};

export function SkillUse({ slug, teamId, skills, rule, names }: SkillUseProps) {
  const collapsibles = useCollapsibles();

  return (
    <InsightsCard
      title="Skills"
      description="Runs that got each skill and runs that read it, per station. A read is a tool call that touches the skill’s folder or names it. The line shows the share of runs that read it, week by week."
    >
      <NestedTable label="Skill use" headings={skillHeadings(rule)}>
        {skills.map((skill) => (
          <SkillRows
            key={skill.key}
            slug={slug}
            teamId={teamId}
            skill={skill}
            names={names}
            collapsibles={collapsibles}
          />
        ))}
      </NestedTable>
    </InsightsCard>
  );
}
