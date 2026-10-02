import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import {
  isReplayRefusal,
  type ReplayRefusal,
} from '@work/domain/exceptions/unreplayable-run.error';

export const REPLAY_RUN_CLAIMS = ['queued', 'forgone', 'refused'] as const;

export type ClaimedAs = (typeof REPLAY_RUN_CLAIMS)[number];

export class ReplayRunClaim {
  private constructor(
    readonly runId: RunId,
    readonly claimedAs: ClaimedAs,
    readonly refusal: ReplayRefusal | null,
    readonly reason: string | null,
  ) {}

  static toQueue(runId: RunId): ReplayRunClaim {
    return new ReplayRunClaim(runId, 'queued', null, null);
  }

  static toForgo(runId: RunId): ReplayRunClaim {
    return new ReplayRunClaim(runId, 'forgone', null, null);
  }

  static rehydrate(input: {
    runId: RunId;
    claimedAs: ClaimedAs;
    refusal: string | null;
    reason: string | null;
  }): ReplayRunClaim {
    const refusal = input.refusal;

    if (refusal !== null && !isReplayRefusal(refusal)) {
      throw new InconsistentStateError(
        'replay run claim',
        `was refused for a reason no longer known, ${refusal}`,
      );
    }
    if ((input.claimedAs === 'refused') !== (refusal !== null)) {
      throw new InconsistentStateError(
        'replay run claim',
        'is refused exactly when it says why',
      );
    }

    return new ReplayRunClaim(
      input.runId,
      input.claimedAs,
      refusal,
      input.reason,
    );
  }

  get mayQueue(): boolean {
    return this.claimedAs === 'queued';
  }

  refused(refusal: ReplayRefusal, reason: string): ReplayRunClaim {
    if (this.claimedAs !== 'queued') {
      throw new InconsistentStateError(
        'replay run claim',
        'is refused only while it is claimed to be queued',
      );
    }

    return new ReplayRunClaim(this.runId, 'refused', refusal, reason);
  }

  forgone(runExists: boolean): ReplayRunClaim {
    if (this.claimedAs !== 'queued' || runExists) {
      return this;
    }

    return new ReplayRunClaim(this.runId, 'forgone', null, null);
  }

  equals(other: ReplayRunClaim): boolean {
    return (
      this.runId.equals(other.runId) &&
      this.claimedAs === other.claimedAs &&
      this.refusal === other.refusal &&
      this.reason === other.reason
    );
  }
}
