import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export const STATION_HISTORY = Symbol('REPLAYS_STATION_HISTORY');

export interface HistoryRunUsage {
  readonly ms: number | null;
  readonly steps: number;
  readonly errors: number;
  readonly contextTokens: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
}

export interface HistoryRun {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly fingerprint: string | null;
  readonly state: string;
  readonly attempt: number;
  readonly harness: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly usage: HistoryRunUsage | null;
  readonly changes: readonly unknown[];
  readonly trace: unknown;
}

export interface HistoryConfig {
  readonly fingerprint: string;
  readonly config: unknown;
}

export interface StationHistoryPort {
  configsNamed(
    fingerprints: readonly string[],
  ): Promise<readonly HistoryConfig[]>;

  runsAmong(
    station: { readonly stationId: StationId; readonly name: string },
    runIds: readonly string[],
    hiddenTaskIds: readonly string[],
  ): Promise<readonly HistoryRun[]>;
}
