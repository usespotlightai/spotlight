import type { RunOutcomeDto } from '@insights/application/dto/run-outcome.dto';
import type {
  ConfigPart,
  StationConfigView,
} from '@insights/application/ports/work.port';
import type {
  RunFailureSummary,
  TaskFailureSummary,
} from '@insights/domain/services/failure-summaries';
import type { DaySpan } from '@insights/domain/services/fingerprint-groups';
import type { RunTally, TallyRates } from '@insights/domain/services/run-tally';

export interface StationConfigPullRequestDto {
  readonly url: string;
}

export interface FingerprintGroupDto extends DaySpan {
  readonly firstRunId: string;
  readonly fingerprint: string | null;
  readonly ran: boolean;
  readonly config: StationConfigView | null;
  readonly changes: readonly ConfigPart[];
  readonly pullRequest: StationConfigPullRequestDto | null;
  readonly runs: readonly RunOutcomeDto[];
  readonly tally: RunTally;
  readonly rates: TallyRates;
}

export interface ConfigInForceDto {
  readonly tally: RunTally;
  readonly taskFailures: readonly TaskFailureSummary[];
  readonly runFailures: readonly RunFailureSummary[];
}

export interface StationInsightsDto {
  readonly stationId: string;
  readonly groups: readonly FingerprintGroupDto[];
  readonly inForce: ConfigInForceDto | null;
}
