import type { StepOutcome } from '@integrations/application/ports/hook-runtime.port';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type {
  CausalChain,
  CauseLink,
} from '@shared-kernel/domain/value-objects/causal-chain.vo';

export const HOOK_FIRINGS = Symbol('HOOK_FIRINGS');

export const CAUSE_HEADER = 'spotlight-cause';

export interface NewFiring {
  readonly id: string;
  readonly hookId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly taskId: string;
  readonly runId: string | null;
  readonly stationKey: string;
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly at: Date;
  readonly event: Readonly<Record<string, unknown>>;
  readonly matched: boolean;
  readonly cause: CausalChain;
  readonly link: CauseLink;
}

export interface StoredFiring extends NewFiring {
  readonly failure: HookFailure | null;
  readonly steps: readonly StepOutcome[];
  readonly attempts: number;
  readonly claimedAt: Date;
}

export interface HookFiringsPort {
  fire(firing: NewFiring): Promise<boolean>;

  claimNext(now: Date): Promise<StoredFiring | null>;

  stepped(
    firing: StoredFiring,
    steps: readonly StepOutcome[],
  ): Promise<boolean>;

  matched(
    firing: StoredFiring,
    event: Readonly<Record<string, unknown>>,
  ): Promise<boolean>;

  worked(firing: StoredFiring, at: Date): Promise<void>;

  waitAt(firing: StoredFiring, at: Date): Promise<void>;

  stopping(firing: StoredFiring, failure: HookFailure): Promise<boolean>;

  retryAt(firing: StoredFiring, failure: HookFailure, at: Date): Promise<void>;

  failed(firing: StoredFiring, failure: HookFailure, at: Date): Promise<void>;

  recentRepeats(firing: StoredFiring, since: Date): Promise<number>;

  chainOf(workspaceId: string, firingId: string): Promise<CausalChain | null>;

  forgetFinished(before: Date, most: number): Promise<number>;
}
