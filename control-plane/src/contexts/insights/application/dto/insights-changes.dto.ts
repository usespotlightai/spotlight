import type { PeriodDto } from '@insights/application/dto/insights.dto';
import type { ConfigPart } from '@insights/application/ports/work.port';
import type { StationJudgeCalibration } from '@insights/application/services/qualified-judges.service';
import type {
  AgentConfigOutcome,
  JudgeOmittedReason,
} from '@insights/domain/services/agent-config-comparison';
import type { MeasureVerdict } from '@insights/domain/services/change-verdict';
import type { JudgeRate } from '@insights/domain/services/judge-rates';
import type { SizeBound } from '@insights/domain/services/run-size';
import type { RunTally } from '@insights/domain/services/run-tally';
import type { Delta } from '@insights/domain/value-objects/delta.vo';

export type StationJudgeCalibrationDto = Omit<
  StationJudgeCalibration,
  'rubricVersion'
>;

export interface ChangeMarkerDto {
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly previousFingerprint: string;
  readonly firstRunAt: string;
  readonly runId: string;
  readonly before: RunTally;
  readonly after: RunTally;
  readonly verdicts: readonly MeasureVerdict[];
  readonly judgeBefore: JudgeRate | null;
  readonly judgeAfter: JudgeRate | null;
  readonly judgeChange: Delta | null;
  readonly changes: readonly ConfigPart[];
}

export interface InsightsChangesDto {
  readonly period: PeriodDto;
  readonly markers: readonly ChangeMarkerDto[];
  readonly judges: readonly StationJudgeCalibrationDto[];
}

export type AgentConfigOutcomeDto = AgentConfigOutcome;

export interface InsightsAgentConfigsDto {
  readonly period: PeriodDto;
  readonly stationId: string | null;
  readonly size: string | null;
  readonly sizes: readonly SizeBound[];
  readonly minRuns: number;
  readonly currency: string | null;
  readonly agentConfigs: readonly AgentConfigOutcomeDto[];
  readonly judgeOmitted: JudgeOmittedReason | null;
  readonly judges: readonly StationJudgeCalibrationDto[];
}
