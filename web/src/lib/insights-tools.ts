import type {
  InsightsToolsResponseDto,
  ServerReportResponseDto,
  SkillReportResponseDto,
  SkillWeekResponseDto,
  ToolDismissalsResponseDto,
  TrendRuleResponseDto,
} from '@/lib/api';
import { formatShortDuration } from '@/lib/inbox';
import { NO_SERVER_FILTER, type RunFilter } from '@/lib/insights';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';

export type InsightsTools = InsightsToolsResponseDto;
export type SkillReport = SkillReportResponseDto;
export type SkillWeek = SkillWeekResponseDto;
export type ServerReport = ServerReportResponseDto;
export type ToolDismissals = ToolDismissalsResponseDto;
export type TrendRule = TrendRuleResponseDto;

export type SkillTrend = NonNullable<SkillReport['trend']>;

const TRENDS: Record<SkillTrend, string> = {
  rising: 'Rising',
  falling: 'Falling',
  flat: 'Flat',
};

export const formatTrend = (trend: SkillTrend): string => TRENDS[trend];

export const formatTrendRule = (rule: TrendRule): string =>
  `Rising or falling: the share of runs that read the skill moved by ${rule.shiftPoints}+ points. Compares the last ${rule.recentWeeks} weeks with the weeks before. Minimum runs on each side: ${rule.minRuns}`;

export const formatLatency = (ms: number | null): string =>
  ms === null ? '–' : formatShortDuration(ms);

export const skillUsedFilter = (
  key: string,
  narrowed: { week?: string; stationId?: string } = {},
): RunFilter => ({ skillUsed: key, ...narrowed });

export const skillEnabledFilter = (key: string): RunFilter => ({
  skillEnabled: key,
});

export const serverFilter = (server: string): RunFilter => ({ server });

export const serverFailedFilter = (server: string): RunFilter => ({
  serverFailed: server,
});

export const failedAfterFilter = (server: string): RunFilter => ({
  failedAfter: server,
});

export const dismissedToolFilter = (dismissed: ToolDismissals): RunFilter => ({
  dismissedTool: dismissed.tool,
  dismissedServer: dismissed.server ?? NO_SERVER_FILTER,
});

export const dismissedServerFilter = (server: string): RunFilter => ({
  dismissedServer: server,
});

export const usedNothing = (tools: InsightsTools): boolean =>
  tools.skills.length === 0 &&
  tools.servers.length === 0 &&
  tools.dismissals.length === 0 &&
  tools.unused.length === 0;

export const skillHeadings = (
  rule: TrendRule | null,
): readonly NestedHeading[] => [
  { label: 'Skill', indent: 'outer', size: 'minmax(12rem,2fr)' },
  { label: 'Read per week', size: 'max-content' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Enabled', numeric: true, size: SPREAD },
  { label: 'Read', numeric: true, size: SPREAD },
  {
    label: 'Trend',
    tooltip: rule ? formatTrendRule(rule) : undefined,
    size: SPREAD,
  },
];

export const SERVER_HEADINGS: readonly NestedHeading[] = [
  { label: 'Server', indent: 'edge', size: 'minmax(10rem,2fr)' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Calls per run', numeric: true, size: SPREAD },
  { label: 'p50', numeric: true, size: SPREAD },
  { label: 'p95', numeric: true, size: SPREAD },
  { label: 'Error rate', numeric: true, size: SPREAD },
  { label: 'Failing runs', numeric: true, size: SPREAD },
  { label: 'Dismissed', numeric: true, size: SPREAD },
];

export const DISMISSAL_HEADINGS: readonly NestedHeading[] = [
  { label: 'Tool', indent: 'edge', size: 'minmax(12rem,2fr)' },
  { label: 'Server', size: SPREAD },
  { label: 'Dismissed', numeric: true, size: SPREAD },
];

export const SKILLS_NOTE =
  'Runs that got each skill and runs that read it, per station. A read is a tool call that touches the skill’s folder or names it. The line shows the share of runs that read it, week by week.';

export const UNUSED_SKILLS_NOTE =
  'Team skills that no run read in this period.';

export const SERVERS_NOTE =
  'MCP servers that runs called. Unfinished calls count as failed. Dismissed calls don’t count. Dismissed: runs with a dismissed call. Failing runs: failed runs whose last call to the server failed';

export const DISMISSALS_NOTE =
  'Runs where a person dismissed a tool approval, per server and tool.';
