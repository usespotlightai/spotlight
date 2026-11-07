import type {
  RunPolicyContract,
  RunRequesterContract,
} from '@runs/application/contracts/run-order.contract';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_FACTS = Symbol('RUN_FACTS');

export type RunStateFact =
  | 'queued'
  | 'claimed'
  | 'suspended'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RunTurnFact = 'pending' | 'kept';

export const RUN_PROGRESS_FACTS = [
  'queued',
  'in-progress',
  'stopping',
] as const;

export type RunProgressFact = (typeof RUN_PROGRESS_FACTS)[number];

export interface RunFacts {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly state: RunStateFact;
  readonly ended: boolean;
  readonly attempt: number;
  readonly stopRequested: boolean;
  readonly turn: RunTurnFact | null;
  readonly suspendedAt: Date | null;
  readonly progress: RunProgressFact | null;
  readonly resumable: boolean;
  readonly claimedBy: RunnerId | null;
  readonly harness: HarnessId;
  readonly requester: RunRequesterContract;
  readonly policy: RunPolicyContract;
  readonly team: TeamId | null;
  readonly checkouts: readonly string[];
  readonly check: string | null;
  readonly setups: ReadonlyMap<string, string>;
  readonly placement: RunnerPlacement;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly started: boolean;
  readonly askedAPerson: boolean;
  readonly failed: boolean;
  readonly exitCode: number | null;
  readonly image: string | null;
  readonly startedFrom: RunStartedFromFact | null;
}

export interface RunStartedFromFact {
  readonly archiveId: string | null;
  readonly archiveStored: boolean;
  readonly at: Date;
  readonly checkouts: readonly {
    readonly path: string;
    readonly commit: string;
  }[];
}

export interface RunFactsPort {
  of(runIds: readonly RunId[]): Promise<readonly RunFacts[]>;
}
