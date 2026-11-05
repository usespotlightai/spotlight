import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { McpServersTable } from '@/components/features/insights/tools/McpServersTable';
import { NoMcpServers } from '@/components/features/insights/tools/NoMcpServers';
import { NoToolsUsed } from '@/components/features/insights/tools/NoToolsUsed';
import { SkillUse } from '@/components/features/insights/tools/SkillUse';
import { ToolsSkeleton } from '@/components/features/insights/tools/ToolsSkeleton';
import { useInsightsTools } from '@/hooks/api/useInsightsTools';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { SERVERS_NOTE, SKILLS_NOTE, usedNothing } from '@/lib/insights-tools';
import { failed, loading } from '@/lib/query';

const TOOLS_TITLE = 'Tools and skills';

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
    return (
      <InsightsSection title={TOOLS_TITLE}>
        <InsightsFailed what="The tools" query={tools} />
      </InsightsSection>
    );
  }

  const insights = tools.data;

  if (insights.runs === 0) {
    return (
      <InsightsSection title={TOOLS_TITLE}>
        <NoRunsInPeriod slug={slug} teamId={teamId}>
          Skills read and MCP servers called show here once stations run tasks.
        </NoRunsInPeriod>
      </InsightsSection>
    );
  }

  if (usedNothing(insights)) {
    return (
      <InsightsSection title={TOOLS_TITLE}>
        <NoToolsUsed slug={slug} teamId={teamId} />
      </InsightsSection>
    );
  }

  return (
    <>
      {(insights.skills.length > 0 || insights.unused.length > 0) && (
        <InsightsSection title="Skills" tooltip={SKILLS_NOTE}>
          <SkillUse
            slug={slug}
            teamId={teamId}
            skills={insights.skills}
            unused={insights.unused}
            teamRuns={insights.runs}
            rule={insights.trendRule}
            names={names}
          />
        </InsightsSection>
      )}

      <InsightsSection title="MCP servers" tooltip={SERVERS_NOTE}>
        {insights.servers.length > 0 || insights.dismissals.length > 0 ? (
          <McpServersTable
            servers={insights.servers}
            dismissals={insights.dismissals}
          />
        ) : (
          <NoMcpServers />
        )}
      </InsightsSection>
    </>
  );
}
