import type { StationConfigShape } from '@work/application/contracts/station-config.contract';
import type {
  HistoryUsage,
  WrittenHistoryRun,
} from '@work/application/dto/runner-history.dto';

export const STATION_HISTORY = Symbol('STATION_HISTORY');

export interface HistoryStation {
  readonly stationId: string;
  readonly stationName: string;
}

export interface StationHistoryRun extends WrittenHistoryRun {
  readonly usage: HistoryUsage | null;
}

export interface HistoryConfig {
  readonly fingerprint: string;
  readonly config: StationConfigShape;
}

export interface StationHistoryPort {
  configsNamed(
    fingerprints: readonly string[],
  ): Promise<readonly HistoryConfig[]>;

  runsAmong(
    station: HistoryStation,
    runIds: readonly string[],
    hiddenTaskIds: readonly string[],
  ): Promise<readonly StationHistoryRun[]>;
}
