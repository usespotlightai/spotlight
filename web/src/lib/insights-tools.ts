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

export const trendShown = (trend: SkillTrend): string => TRENDS[trend];

export const trendRuleShown = (rule: TrendRule): string =>
  `Spreading or fading: the share of all runs that read the skill moved ${rule.shiftPoints} points or more over the last ${rule.recentWeeks} weeks against the weeks before, with at least ${rule.fewestRuns} runs on each side.`;

export const latencyShown = (ms: number | null): string =>
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
