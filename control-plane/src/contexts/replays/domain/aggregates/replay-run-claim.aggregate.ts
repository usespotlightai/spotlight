import type { ClaimedAs } from '@replays/domain/value-objects/replay-run-claimed';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ClaimedTrial {
  readonly fingerprint: StationFingerprint | null;
  readonly movesOnAfter: readonly string[];
}

interface State {
  readonly runId: RunId;
  readonly claimedAs: ClaimedAs;
  readonly unreplayableReason: UnreplayableReason | null;
  readonly reason: string | null;
  readonly trial: ClaimedTrial | null;
  readonly version: number;
}

const HOLDER = 'replay run claim';

const sameTrial = (one: ClaimedTrial, other: ClaimedTrial): boolean =>
  (one.fingerprint === null
    ? other.fingerprint === null
    : other.fingerprint !== null &&
      one.fingerprint.equals(other.fingerprint)) &&
  one.movesOnAfter.length === other.movesOnAfter.length &&
  one.movesOnAfter.every((word, at) => word === other.movesOnAfter[at]);

export class ReplayRunClaim {
  private constructor(private readonly state: State) {}

  static toQueue(runId: RunId): ReplayRunClaim {
    return new ReplayRunClaim({
      runId,
      claimedAs: 'queued',
      unreplayableReason: null,
      reason: null,
      trial: null,
      version: 0,
    });
  }

  static toCancel(runId: RunId): ReplayRunClaim {
    return new ReplayRunClaim({
      runId,
      claimedAs: 'cancelled',
      unreplayableReason: null,
      reason: null,
      trial: null,
      version: 0,
    });
  }

  static rehydrate(state: State): ReplayRunClaim {
    if (
      (state.claimedAs === 'unreplayable') !==
      (state.unreplayableReason !== null)
    ) {
      throw new InconsistentStateError(
        HOLDER,
        'is unreplayable exactly when it says why',
      );
    }

    return new ReplayRunClaim(state);
  }

  get runId(): RunId {
    return this.state.runId;
  }

  get claimedAs(): ClaimedAs {
    return this.state.claimedAs;
  }

  get unreplayableReason(): UnreplayableReason | null {
    return this.state.unreplayableReason;
  }

  get reason(): string | null {
    return this.state.reason;
  }

  get trial(): ClaimedTrial | null {
    return this.state.trial;
  }

  get version(): number {
    return this.state.version;
  }

  get mayQueue(): boolean {
    return this.state.claimedAs === 'queued';
  }

  ordered(trial: ClaimedTrial): ReplayRunClaim {
    if (!this.mayQueue) {
      throw new InconsistentStateError(
        HOLDER,
        'records the trial it ordered only while it is claimed to be queued',
      );
    }

    if (this.state.trial && sameTrial(this.state.trial, trial)) {
      return this;
    }

    return this.with({
      trial: {
        fingerprint: trial.fingerprint,
        movesOnAfter: trial.movesOnAfter.map((word) => word.toLowerCase()),
      },
    });
  }

  unreplayable(
    unreplayableReason: UnreplayableReason,
    reason: string,
  ): ReplayRunClaim {
    if (!this.mayQueue) {
      throw new InconsistentStateError(
        HOLDER,
        'becomes unreplayable only while it is claimed to be queued',
      );
    }

    return this.with({ claimedAs: 'unreplayable', unreplayableReason, reason });
  }

  cancelled(): ReplayRunClaim {
    return this.mayQueue ? this.with({ claimedAs: 'cancelled' }) : this;
  }

  askedAPersonAfter(handsOver: boolean, next: string | null): boolean {
    if (!handsOver) {
      return false;
    }

    return !(
      next !== null &&
      (this.state.trial?.movesOnAfter ?? []).includes(next.toLowerCase())
    );
  }

  private with(part: Partial<State>): ReplayRunClaim {
    return new ReplayRunClaim({ ...this.state, ...part });
  }
}
