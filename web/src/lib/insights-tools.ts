import type {
  InsightsToolsResponseDto,
  ServerReportResponseDto,
  SkillReportResponseDto,
  SkillWeekResponseDto,
  ToolRefusalsResponseDto,
  TrendRuleResponseDto,
} from '@/lib/api';
import { took } from '@/lib/inbox';
import { NO_SERVER_FILTER, type RunFilter } from '@/lib/insights';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';

export type InsightsTools = InsightsToolsResponseDto;
export type SkillReport = SkillReportResponseDto;
export type SkillWeek = SkillWeekResponseDto;
export type ServerReport = ServerReportResponseDto;
export type ToolRefusals = ToolRefusalsResponseDto;
export type TrendRule = TrendRuleResponseDto;

export type SkillTrend = NonNullable<SkillReport['trend']>;

const TRENDS: Record<SkillTrend, string> = {
  spreading: 'Spreading',
  fading: 'Fading',
  steady: 'Steady',
};

export const formatTrend = (trend: SkillTrend): string => TRENDS[trend];

export const formatTrendRule = (rule: TrendRule): string =>
  `Spreading or fading: the share of runs that read the skill moved by ${rule.shiftPoints}+ points. Compares the last ${rule.recentWeeks} weeks with the weeks before. Minimum runs on each side: ${rule.minRuns}`;

export const formatLatency = (ms: number | null): string =>
  ms === null ? '–' : took(ms);

export const skillUsedFilter = (
  key: string,
  narrowed: { week?: string; stationId?: string } = {},
): RunFilter => ({ skillUsed: key, ...narrowed });

export const skillGivenFilter = (key: string): RunFilter => ({
  skillGiven: key,
});

export const serverFilter = (server: string): RunFilter => ({ server });

export const serverFailedFilter = (server: string): RunFilter => ({
  serverFailed: server,
});

export const failedAfterFilter = (server: string): RunFilter => ({
  failedAfter: server,
});

export const refusedToolFilter = (refused: ToolRefusals): RunFilter => ({
  refusedTool: refused.tool,
  refusedServer: refused.server ?? NO_SERVER_FILTER,
});

export const refusedServerFilter = (server: string): RunFilter => ({
  refusedServer: server,
});

export const usedNothing = (tools: InsightsTools): boolean =>
  tools.skills.length === 0 &&
  tools.servers.length === 0 &&
  tools.refusals.length === 0 &&
  tools.unused.length === 0;

export const skillHeadings = (rule: TrendRule): readonly NestedHeading[] => [
  { label: 'Skill', indent: 'outer', size: 'minmax(12rem,2fr)' },
  { label: 'Read per week', size: 'max-content' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Given', numeric: true, size: SPREAD },
  { label: 'Read', numeric: true, size: SPREAD },
  { label: 'Trend', note: formatTrendRule(rule), size: SPREAD },
];

export const SERVER_HEADINGS: readonly NestedHeading[] = [
  { label: 'Server', indent: 'edge', size: 'minmax(10rem,2fr)' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Calls per run', numeric: true, size: SPREAD },
  { label: 'p50', numeric: true, size: SPREAD },
  { label: 'p95', numeric: true, size: SPREAD },
  { label: 'Error rate', numeric: true, size: SPREAD },
  { label: 'Failing runs', numeric: true, size: SPREAD },
  { label: 'Refused', numeric: true, size: SPREAD },
];

export const REFUSAL_HEADINGS: readonly NestedHeading[] = [
  { label: 'Tool', indent: 'edge', size: 'minmax(12rem,2fr)' },
  { label: 'Server', size: SPREAD },
  { label: 'Refused', numeric: true, size: SPREAD },
];
