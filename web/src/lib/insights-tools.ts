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
import { FIGURE, type NestedHeading } from '@/lib/nested-table';

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

export const formatLatency = (ms: number | null): string => {
  if (ms === null) {
    return '–';
  }

  return ms >= 1_000 && ms < 10_000
    ? `${(ms / 1_000).toFixed(1)}s`
    : formatShortDuration(ms);
};

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

export const MIN_READ_SHARE = 0.05;

export const readShareMax = (skills: readonly SkillReport[]): number =>
  Math.max(
    MIN_READ_SHARE,
    ...skills.flatMap((skill) => skill.weeks.map((week) => week.usedRate ?? 0)),
  );

export const skillHeadings = (
  rule: TrendRule | null,
  max: number,
): readonly NestedHeading[] => [
  { label: 'Skill', indent: 'outer', size: 'minmax(12rem,1fr)' },
  {
    label: 'Runs',
    numeric: true,
    size: FIGURE,
    tooltip: 'Runs that ended in the period, the team’s or the station’s',
  },
  {
    label: 'Runs given',
    numeric: true,
    size: FIGURE,
    tooltip: 'Runs whose station config gave the skill',
  },
  {
    label: 'Runs read',
    numeric: true,
    size: FIGURE,
    tooltip:
      'Runs that read the skill: a tool call touched its folder or named it',
  },
  {
    label: 'Share read',
    size: 'max-content',
    tooltip: {
      title: 'Share read',
      body: `The share of runs that read the skill. The figure covers the whole period. The bars show each week on one scale, from 0 to ${Math.round(max * 100)}%. A hollow bar is a week the period only partly covers.${rule ? ` ${formatTrendRule(rule)}.` : ''}`,
    },
  },
];

export const givenOf = (counts: { enabled: number; used: number }): string =>
  counts.enabled === 0 && counts.used > 0
    ? 'Not given'
    : counts.enabled.toLocaleString();

export const NOT_GIVEN_NOTE =
  'Runs read the skill though their station config didn’t give it.';

export const UNUSED_TITLE = 'Not read in this period';

export const SERVER_HEADINGS: readonly NestedHeading[] = [
  { label: 'Server', indent: 'edge', size: 'minmax(12rem,1fr)' },
  { label: 'Runs', numeric: true, size: FIGURE },
  { label: 'Calls per run', numeric: true, size: FIGURE },
  {
    label: 'Median call',
    numeric: true,
    size: FIGURE,
    tooltip: 'Half of the calls took less time',
  },
  {
    label: 'Slowest 5%',
    numeric: true,
    size: FIGURE,
    tooltip: '95 of 100 calls were faster',
  },
  {
    label: 'Error rate',
    numeric: true,
    size: FIGURE,
    tooltip:
      'The share of calls that failed. Unfinished calls count as failed.',
  },
  {
    label: 'Failing runs',
    numeric: true,
    size: FIGURE,
    tooltip:
      'Failed runs whose last call to the server failed, as a share of its runs',
  },
  {
    label: 'Dismissed',
    numeric: true,
    size: FIGURE,
    tooltip:
      'Runs where a person dismissed one of its tool approvals, as a share of its runs. Open a server to see the tools.',
  },
];

export const OTHER_TOOLS = 'Other tools';

export const SKILLS_NOTE =
  'Each skill the team’s runs read, with the stations that gave or read it. Open a skill to see its stations.';

export const UNUSED_SKILLS_NOTE =
  'Team skills that no run read in this period.';

export const SERVERS_NOTE =
  'Each MCP server the team’s runs called. Dismissed calls don’t count as calls.';

export const SKILL_WEEK_BAR = 14;

export const SKILL_WEEK_GAP = 2;

export const weeksWidth = (weeks: number): number =>
  weeks * SKILL_WEEK_BAR + Math.max(weeks - 1, 0) * SKILL_WEEK_GAP;
