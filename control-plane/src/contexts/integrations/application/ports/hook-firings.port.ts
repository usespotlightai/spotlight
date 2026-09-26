import type { StepOutcome } from '@integrations/application/ports/hook-runtime.port';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';

export const HOOK_FIRINGS = Symbol('HOOK_FIRINGS');

export interface NewFiring {
  readonly id: string;
  readonly hookId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly taskId: string;
  readonly runId: string | null;
  readonly on: HookEventName;
  readonly occurrence: string;
  readonly at: Date;
  readonly event: Readonly<Record<string, unknown>>;
  readonly matched: boolean;
}

export interface StoredFiring extends NewFiring {
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

  retryAt(firing: StoredFiring, because: string, at: Date): Promise<void>;

  failed(firing: StoredFiring, because: string, at: Date): Promise<void>;

  forgetFinished(before: Date, most: number): Promise<number>;
}
