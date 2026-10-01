import type { PeriodDto } from '@outcomes/application/dto/insights.dto';
import type { ConfigPart } from '@outcomes/application/ports/work.port';
import type { StationJudgeStanding } from '@outcomes/application/services/trusted-judges.service';
import type { MeasureVerdict } from '@outcomes/domain/services/change-verdict';
import type { JudgeShare } from '@outcomes/domain/services/judge-shares';
import type { SizeBound } from '@outcomes/domain/services/run-size';
import type { RunTally } from '@outcomes/domain/services/run-tally';
import type {
  JudgeWithheld,
  SetupOutcome,
} from '@outcomes/domain/services/setup-comparison';

export type StationStandingDto = Omit<StationJudgeStanding, 'rubricVersion'>;

export interface ChangeMarkerDto {
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly previousFingerprint: string | null;
  readonly firstRunAt: string;
  readonly runId: string;
  readonly before: RunTally;
  readonly after: RunTally;
  readonly verdicts: readonly MeasureVerdict[];
  readonly judgeBefore: JudgeShare | null;
  readonly judgeAfter: JudgeShare | null;
  readonly changes: readonly ConfigPart[];
}

export interface InsightsChangesDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly markers: readonly ChangeMarkerDto[];
  readonly judges: readonly StationStandingDto[];
}

export type SetupOutcomeDto = SetupOutcome;

export interface InsightsSetupsDto {
  readonly period: PeriodDto;
  readonly truncated: boolean;
  readonly stationId: string | null;
  readonly size: string | null;
  readonly sizes: readonly SizeBound[];
  readonly fewestRuns: number;
  readonly currency: string | null;
  readonly setups: readonly SetupOutcomeDto[];
  readonly judgeWithheld: JudgeWithheld | null;
  readonly judges: readonly StationStandingDto[];
}
