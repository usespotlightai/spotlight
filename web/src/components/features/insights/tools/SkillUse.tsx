import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { SkillMultiple } from '@/components/features/insights/tools/SkillMultiple';
import { SkillUseTable } from '@/components/features/insights/tools/SkillUseTable';
import type { StationNames } from '@/lib/insights';
import {
  type SkillReport,
  type TrendRule,
  trendRuleShown,
} from '@/lib/insights-tools';

type SkillUseProps = {
  slug: string;
  teamId: string;
  skills: readonly SkillReport[];
  weeks: readonly string[];
  rule: TrendRule;
  names: StationNames;
};

export function SkillUse({
  slug,
  teamId,
  skills,
  weeks,
  rule,
  names,
}: SkillUseProps) {
  const ruleShown = trendRuleShown(rule);

  return (
    <InsightsCard
      title="Skills"
      description="Runs that read each skill per week, against all runs. A read is a tool call that touches the skill’s folder or names it."
      table={<SkillUseTable skills={skills} weeks={weeks} />}
    >
      <ul
        aria-label="Skill use by week"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {skills.map((skill) => (
          <SkillMultiple
            key={skill.key}
            slug={slug}
            teamId={teamId}
            skill={skill}
            rule={ruleShown}
            names={names}
          />
        ))}
      </ul>
      <p data-slot="trend-rule" className="text-muted-foreground text-xs">
        {ruleShown}
      </p>
    </InsightsCard>
  );
}
