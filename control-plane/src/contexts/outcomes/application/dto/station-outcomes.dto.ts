import type { RunOutcomeDto } from '@outcomes/application/dto/run-outcome.dto';
import type {
  ConfigPart,
  StationConfigView,
} from '@outcomes/application/ports/work.port';
import type { StationTally } from '@outcomes/domain/services/station-tally';

export interface FingerprintGroupDto {
  readonly fingerprint: string | null;
  readonly config: StationConfigView | null;
  readonly changes: readonly ConfigPart[];
  readonly runs: readonly RunOutcomeDto[];
  readonly tally: StationTally;
}

export interface StationOutcomesDto {
  readonly stationId: string;
  readonly groups: readonly FingerprintGroupDto[];
}
