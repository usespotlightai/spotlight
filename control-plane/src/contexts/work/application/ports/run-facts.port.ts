import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  RunPolicyContract,
  RunRequesterContract,
} from '@work/application/contracts/run-order.contract';

export const RUN_FACTS = Symbol('RUN_FACTS');

export type RunSubjectFacts =
  | {
      readonly kind: 'task';
      readonly taskId: TaskId;
      readonly stationId: StationId | null;
      readonly revision: number;
    }
  | { readonly kind: 'chat'; readonly chatId: string }
  | {
      readonly kind: 'replay';
      readonly replayOf: RunId;
      readonly taskId: TaskId;
      readonly stationId: StationId | null;
      readonly teamId: TeamId;
    }
  | {
      readonly kind: 'search';
      readonly searchId: string;
      readonly iteration: number;
      readonly stationId: StationId | null;
      readonly teamId: TeamId;
    };

export type RunStateFact =
  | 'queued'
  | 'claimed'
  | 'suspended'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RunFacts {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly state: RunStateFact;
  readonly ended: boolean;
  readonly attempt: number;
  readonly stopRequested: boolean;
  readonly claimedBy: RunnerId | null;
  readonly harness: HarnessId;
  readonly requester: RunRequesterContract;
  readonly policy: RunPolicyContract;
  readonly team: TeamId | null;
  readonly subject: RunSubjectFacts | null;
  readonly checkouts: readonly string[];
}

export interface RunFactsPort {
  of(runIds: readonly RunId[]): Promise<readonly RunFacts[]>;
}
