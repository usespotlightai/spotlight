import type { RunOutcomeDto } from '@outcomes/application/dto/run-outcome.dto';
import type {
  ConfigPart,
  StationConfigView,
} from '@outcomes/application/ports/work.port';
import type { DaySpan } from '@outcomes/domain/services/fingerprint-groups';
import type {
  RunTally,
  TallyShares,
} from '@outcomes/domain/services/run-tally';

export interface FingerprintGroupDto extends DaySpan {
  readonly firstRunId: string;
  readonly fingerprint: string | null;
  readonly ran: boolean;
  readonly config: StationConfigView | null;
  readonly changes: readonly ConfigPart[];
  readonly runs: readonly RunOutcomeDto[];
  readonly tally: RunTally;
  readonly shares: TallyShares;
}

export interface ConfigInForceDto {
  readonly tally: RunTally;
}

export interface StationOutcomesDto {
  readonly stationId: string;
  readonly groups: readonly FingerprintGroupDto[];
  readonly inForce: ConfigInForceDto | null;
}
