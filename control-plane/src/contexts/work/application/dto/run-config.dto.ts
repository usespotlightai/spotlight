import type {
  ConfigChangeShape,
  StationConfigShape,
} from '@work/application/contracts/station-config.contract';

export interface RunConfigDto {
  readonly fingerprint: string | null;
  readonly config: StationConfigShape | null;
  readonly changedSince: {
    readonly runId: string;
    readonly taskId: string;
    readonly fingerprint: string;
    readonly changes: readonly ConfigChangeShape[];
  } | null;
}
