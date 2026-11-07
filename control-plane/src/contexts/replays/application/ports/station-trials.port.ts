import type { OracleAnswer } from '@replays/domain/services/oracle-answer';
import type { MovesOnWords } from '@replays/domain/value-objects/moves-on-words.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const STATION_TRIALS = Symbol('REPLAYS_STATION_TRIALS');

export interface TrialRequest {
  readonly run: RunId;
  readonly original: RunId;
  readonly workspaceId: WorkspaceId;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly block: StationBlock;
  readonly line: PlannedLine | null;
  readonly answer: OracleAnswer | null;
}

export interface OrderedTrial {
  readonly fingerprint: StationFingerprint | null;
  readonly movesOnAfter: MovesOnWords;
}

export type TrialOrdering =
  | { readonly ordered: true; readonly trial: OrderedTrial }
  | {
      readonly ordered: false;
      readonly unreplayableReason: UnreplayableReason;
    };

export interface StationTrialsPort {
  answers(original: RunId): Promise<readonly OracleAnswer[]>;

  order(request: TrialRequest): Promise<TrialOrdering>;

  withdraw(run: RunId): Promise<void>;
}
