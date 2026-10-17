import type { PeriodDto } from '@outcomes/application/dto/insights.dto';
import type {
  ServerReport,
  SkillReport,
  ToolRefusals,
} from '@outcomes/domain/services/tool-insights';

export interface TrendRuleDto {
  readonly recentWeeks: number;
  readonly minRuns: number;
  readonly shiftPoints: number;
}

export type SkillReportDto = SkillReport;

export type ServerReportDto = ServerReport;

export type ToolRefusalsDto = ToolRefusals;

export interface InsightsToolsDto {
  readonly period: PeriodDto;
  readonly weeks: readonly string[];
  readonly runs: number;
  readonly trendRule: TrendRuleDto;
  readonly skills: readonly SkillReportDto[];
  readonly unused: readonly string[];
  readonly servers: readonly ServerReportDto[];
  readonly refusals: readonly ToolRefusalsDto[];
}
