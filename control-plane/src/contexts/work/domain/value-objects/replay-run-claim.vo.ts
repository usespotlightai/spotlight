import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import {
  isUnreplayableReason,
  type UnreplayableReason,
} from '@work/domain/exceptions/unreplayable-run.error';

export const REPLAY_RUN_CLAIMS = ['queued', 'forgone', 'unreplayable'] as const;

export type ClaimedAs = (typeof REPLAY_RUN_CLAIMS)[number];

export class ReplayRunClaim {
  private constructor(
    readonly runId: RunId,
    readonly claimedAs: ClaimedAs,
    readonly unreplayableReason: UnreplayableReason | null,
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
    unreplayableReason: string | null;
    reason: string | null;
  }): ReplayRunClaim {
    const unreplayableReason = input.unreplayableReason;

    if (
      unreplayableReason !== null &&
      !isUnreplayableReason(unreplayableReason)
    ) {
      throw new InconsistentStateError(
        'replay run claim',
        `has an unreplayable reason that is no longer known, ${unreplayableReason}`,
      );
    }
    if (
      (input.claimedAs === 'unreplayable') !==
      (unreplayableReason !== null)
    ) {
      throw new InconsistentStateError(
        'replay run claim',
        'is unreplayable exactly when it says why',
      );
    }

    return new ReplayRunClaim(
      input.runId,
      input.claimedAs,
      unreplayableReason,
      input.reason,
    );
  }

  get mayQueue(): boolean {
    return this.claimedAs === 'queued';
  }

  unreplayable(
    unreplayableReason: UnreplayableReason,
    reason: string,
  ): ReplayRunClaim {
    if (this.claimedAs !== 'queued') {
      throw new InconsistentStateError(
        'replay run claim',
        'becomes unreplayable only while it is claimed to be queued',
      );
    }

    return new ReplayRunClaim(
      this.runId,
      'unreplayable',
      unreplayableReason,
      reason,
    );
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
      this.unreplayableReason === other.unreplayableReason &&
      this.reason === other.reason
    );
  }
}
