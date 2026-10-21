import type { ConfigFileChange } from '@replays/application/ports/config-repository.port';
import type { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';

export interface StationSourceEdit {
  readonly file: ConfigFileChange;
  readonly teamKey: string;
  readonly lineKey: string;
  readonly stationKey: string;
  readonly seed: StationBlock;
  readonly candidate: StationBlock;
  readonly module: readonly string[];
  readonly read: (path: string) => Promise<string | null>;
}

export type StationSourceEdited =
  | {
      readonly ok: true;
      readonly files: readonly ConfigFileChange[];
      readonly unchecked: readonly string[];
    }
  | { readonly ok: false; readonly reason: ConfigPullRequestReason };

export const STATION_SOURCE_EDITOR = Symbol('STATION_SOURCE_EDITOR');

export interface StationSourceEditorPort {
  edited(edit: StationSourceEdit): Promise<StationSourceEdited>;
}
