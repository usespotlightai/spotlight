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

const RUN_PROGRESS_FACTS = ['queued', 'in-progress', 'stopping'] as const;

export type RunProgressFact = (typeof RUN_PROGRESS_FACTS)[number];

export const RUN_WAIT_REASON_FACTS = [
  'hosts-pull',
  'hosts-offline',
  'no-pool-has-room',
  'platform-pool-not-allowed',
  'no-pool-matches',
] as const;

type RunWaitReasonFact = (typeof RUN_WAIT_REASON_FACTS)[number];

export const RUNNER_SOURCE_KIND_FACTS = ['pool', 'trust'] as const;

// The pool or trust of the runner that claimed the run last, as it was then.
export interface RunnerSourceFact {
  readonly kind: (typeof RUNNER_SOURCE_KIND_FACTS)[number];
  readonly key: string;
  // The platform pool that Spotlight adds to each workspace.
  readonly platform: boolean;
}

// The hosts a queued run waits for while none of them reports in, and when Spotlight last heard from one of them. Since is null when none is left to hear from.
interface QuietHostsFact {
  readonly hosts: readonly string[];
  readonly since: Date | null;
}

// Why Spotlight provisions no runner for the queued run, and since when. Quiet is set for hosts-offline.
export interface RunWaitFact {
  readonly reason: RunWaitReasonFact;
  readonly since: Date;
  readonly quiet: QuietHostsFact | null;
}

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
  readonly working: boolean;
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
  readonly spent: RunTimeSpentFact;
  readonly started: boolean;
  readonly askedAPerson: boolean;
  readonly failed: boolean;
  readonly exitCode: number | null;
  readonly image: string | null;
  readonly ranOn: RunnerSourceFact | null;
  readonly waiting: RunWaitFact | null;
  readonly startedFrom: RunStartedFromFact | null;
  readonly endHeads: readonly {
    readonly path: string;
    readonly commit: string;
  }[];
}

interface RunTimeSpentFact {
  readonly queuedMs: number;
  readonly runningMs: number;
  readonly firstStartedAt: Date | null;
}

interface RunStartedFromFact {
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
