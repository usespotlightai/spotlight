import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { McpServers } from '@/components/features/insights/tools/McpServers';
import { NoToolsUsed } from '@/components/features/insights/tools/NoToolsUsed';
import { RefusedTools } from '@/components/features/insights/tools/RefusedTools';
import { SkillUse } from '@/components/features/insights/tools/SkillUse';
import { ToolsSkeleton } from '@/components/features/insights/tools/ToolsSkeleton';
import { UnusedSkills } from '@/components/features/insights/tools/UnusedSkills';
import { useInsightsTools } from '@/hooks/api/useInsightsTools';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { usedNothing } from '@/lib/insights-tools';
import { failed, loading } from '@/lib/query';

type ToolsTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function ToolsTab({ slug, teamId, period, names }: ToolsTabProps) {
  const tools = useInsightsTools(teamId, period);

  if (loading(tools)) {
    return <ToolsSkeleton />;
  }

  if (failed(tools) || !tools.data) {
    return <InsightsFailed what="The tools" query={tools} />;
  }

  const insights = tools.data;

  if (insights.runs === 0) {
    return (
      <NoRunsInPeriod slug={slug} teamId={teamId}>
        Skills read and MCP servers called show here once stations run tasks.
      </NoRunsInPeriod>
    );
  }

  if (usedNothing(insights)) {
    return <NoToolsUsed slug={slug} teamId={teamId} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {insights.skills.length > 0 && (
        <SkillUse
          slug={slug}
          teamId={teamId}
          skills={insights.skills}
          rule={insights.trendRule}
          names={names}
        />
      )}

      {insights.unused.length > 0 && (
        <UnusedSkills slug={slug} teamId={teamId} unused={insights.unused} />
      )}

      <McpServers servers={insights.servers} />

      {insights.refusals.length > 0 && (
        <RefusedTools refusals={insights.refusals} />
      )}
    </div>
  );
}
