import type {
  CorrelationReading,
  KappaReading,
} from '@insights/domain/services/agreement-reading';
import type { MeasureVerdict } from '@insights/domain/services/change-verdict';
import type {
  RunFailureSummary,
  TaskFailureSummary,
} from '@insights/domain/services/failure-summaries';
import type {
  AgreementReadings,
  Coverage,
  TrendPoint,
} from '@insights/domain/services/judge-agreement';
import type { JudgeRate } from '@insights/domain/services/judge-rates';
import type { ByPercentile } from '@insights/domain/services/measures';
import type { SizeBound } from '@insights/domain/services/run-size';
import type {
  RunTally,
  TallyCounted,
  TallyRates,
  TallySeen,
  ResolutionCounts,
  ResolutionShares,
} from '@insights/domain/services/run-tally';
import type { SignalReading } from '@insights/domain/services/station-ranking';
import type { DayTally } from '@insights/domain/services/station-reports';
import type {
  SkillAtStation,
  SkillWeek,
} from '@insights/domain/services/tool-insights';

export type CorrelationReadingDto = CorrelationReading;

export type KappaReadingDto = KappaReading;

export type AgreementReadingsDto = AgreementReadings;

export type CoverageDto = Coverage;

export type TrendPointDto = TrendPoint;

export type RunTallyDto = RunTally;

export type ResolutionCountsDto = ResolutionCounts;

export type ResolutionSharesDto = ResolutionShares;

export type TallyRatesDto = TallyRates;

export type SignalReadingDto = SignalReading;

export type TallyCountedDto = TallyCounted;

export type TallySeenDto = TallySeen;

export type DayTallyDto = DayTally;

export type RunFailureSummaryDto = RunFailureSummary;

export type TaskFailureSummaryDto = TaskFailureSummary;

export type MeasureVerdictDto = MeasureVerdict;

export type ByPercentileDto<T> = ByPercentile<T>;

export type JudgeRateDto = JudgeRate;

export type SizeBoundDto = SizeBound;

export type SkillAtStationDto = SkillAtStation;

export type SkillWeekDto = SkillWeek;
