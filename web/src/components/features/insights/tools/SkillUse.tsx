import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { SkillRows } from '@/components/features/insights/tools/SkillRows';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useCollapsibles } from '@/hooks/useCollapsibles';
import type { StationNames } from '@/lib/insights';
import {
  SKILLS_NOTE,
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
    <InsightsCard scrolls title="Skills" description={SKILLS_NOTE}>
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
