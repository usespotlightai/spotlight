import type { MovesOnWords } from '@replays/domain/value-objects/moves-on-words.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayRunDecided } from '@replays/domain/value-objects/replay-run-decided';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HANDOVER_TO_A_PERSON } from '@shared-kernel/domain/value-objects/handover-word';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ReplayRunOwner {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly replayId: ReplayId;
}

export interface DecidedTrial {
  readonly fingerprint: StationFingerprint | null;
  readonly movesOnAfter: MovesOnWords;
}

export interface ReplayRunEnding {
  readonly askedAPerson: boolean;
  readonly handsOver: boolean;
  readonly next: string | null;
}

interface State {
  readonly runId: RunId;
  readonly owner: ReplayRunOwner;
  readonly decided: ReplayRunDecided;
  readonly unreplayableReason: UnreplayableReason | null;
  readonly trial: DecidedTrial | null;
  readonly version: number;
}

const HOLDER = 'replay run decision';

const sameTrial = (one: DecidedTrial, other: DecidedTrial): boolean =>
  (one.fingerprint === null
    ? other.fingerprint === null
    : other.fingerprint !== null &&
      one.fingerprint.equals(other.fingerprint)) &&
  one.movesOnAfter.equals(other.movesOnAfter);

const handsOverForReview = (ending: ReplayRunEnding): boolean =>
  ending.next?.toLowerCase() === HANDOVER_TO_A_PERSON;

export const replayAskedAPerson = (
  ending: ReplayRunEnding,
  decision: ReplayRunDecision | null,
): boolean =>
  ending.askedAPerson ||
  (decision
    ? decision.askedAPersonAfter(ending)
    : ending.handsOver && !handsOverForReview(ending));

export class ReplayRunDecision {
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {}

  static decidedToQueue(
    runId: RunId,
    owner: ReplayRunOwner,
  ): ReplayRunDecision {
    return ReplayRunDecision.first(runId, owner, 'queued');
  }

  static decidedToCancel(
    runId: RunId,
    owner: ReplayRunOwner,
  ): ReplayRunDecision {
    return ReplayRunDecision.first(runId, owner, 'cancelled');
  }

  static rehydrate(state: State): ReplayRunDecision {
    if (
      (state.decided === 'unreplayable') !==
      (state.unreplayableReason !== null)
    ) {
      throw new InconsistentStateError(
        HOLDER,
        'is unreplayable exactly when it says why',
      );
    }

    return new ReplayRunDecision(state);
  }

  private static first(
    runId: RunId,
    owner: ReplayRunOwner,
    decided: ReplayRunDecided,
  ): ReplayRunDecision {
    return new ReplayRunDecision({
      runId,
      owner,
      decided,
      unreplayableReason: null,
      trial: null,
      version: 0,
    });
  }

  get runId(): RunId {
    return this.state.runId;
  }

  get owner(): ReplayRunOwner {
    return this.state.owner;
  }

  get decided(): ReplayRunDecided {
    return this.state.decided;
  }

  get unreplayableReason(): UnreplayableReason | null {
    return this.state.unreplayableReason;
  }

  get trial(): DecidedTrial | null {
    return this.state.trial;
  }

  get version(): number {
    return this.state.version;
  }

  get mayQueue(): boolean {
    return this.state.decided === 'queued';
  }

  ordered(trial: DecidedTrial): ReplayRunDecision {
    if (
      !this.mayQueue ||
      (this.state.trial && sameTrial(this.state.trial, trial))
    ) {
      return this;
    }

    return this.with({ trial });
  }

  unreplayable(unreplayableReason: UnreplayableReason): ReplayRunDecision {
    return this.mayQueue
      ? this.with({ decided: 'unreplayable', unreplayableReason })
      : this;
  }

  cancelled(): ReplayRunDecision {
    return this.mayQueue ? this.with({ decided: 'cancelled' }) : this;
  }

  askedAPersonAfter(ending: ReplayRunEnding): boolean {
    if (!ending.handsOver || handsOverForReview(ending)) {
      return false;
    }

    return !(
      ending.next !== null &&
      (this.state.trial?.movesOnAfter.includes(ending.next) ?? false)
    );
  }

  delete(): ReplayRunDecision {
    return new ReplayRunDecision(this.state, true);
  }

  private with(part: Partial<State>): ReplayRunDecision {
    return new ReplayRunDecision({ ...this.state, ...part });
  }
}
