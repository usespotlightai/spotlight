import type { OracleAnswer } from '@replays/domain/services/oracle-answer';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunOrderContract } from '@work/application/contracts/run-order.contract';

export const STATION_TRIALS = Symbol('REPLAYS_STATION_TRIALS');

export interface TrialRequest {
  readonly run: RunId;
  readonly original: RunId;
  readonly workspaceId: WorkspaceId;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly block: unknown;
  readonly repositories: unknown;
  readonly answer: OracleAnswer | null;
}

export type TrialOrder = Omit<
  RunOrderContract,
  'requester' | 'policy' | 'workspace' | 'extensions' | 'apiGrant' | 'tags'
>;

export interface TrialCheckout {
  readonly path: string;
  readonly repository: string;
  readonly commit: string;
}

export type TrialOrdering =
  | {
      readonly ordered: true;
      readonly order: TrialOrder;
      readonly team: string;
      readonly fingerprint: StationFingerprint | null;
      readonly checkouts: readonly TrialCheckout[];
      readonly movesOnAfter: readonly string[];
    }
  | {
      readonly ordered: false;
      readonly unreplayableReason: UnreplayableReason;
      readonly reason: string;
    };

export interface StationTrialsPort {
  answers(original: RunId): Promise<readonly OracleAnswer[]>;

  order(request: TrialRequest): Promise<TrialOrdering>;

  withdraw(run: RunId): Promise<void>;
}
