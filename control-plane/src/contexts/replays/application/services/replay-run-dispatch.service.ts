import type { RunsPort } from '@replays/application/ports/runs.port';
import type {
  StationTrialsPort,
  TrialOrdering,
} from '@replays/application/ports/station-trials.port';
import { ReplayRunClaim } from '@replays/domain/aggregates/replay-run-claim.aggregate';
import { ReplayRunClaimVersionConflictError } from '@replays/domain/exceptions/replay-run-claim-version-conflict.error';
import type { ReplayRunClaimRepository } from '@replays/domain/repositories/replay-run-claim.repository';
import type { OracleAnswer } from '@replays/domain/services/oracle-answer';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type RunOrderContract,
  type RunPolicyContract,
  workspaceKeyOf,
} from '@work/application/contracts/run-order.contract';

export interface ReplayRunOrder {
  readonly run: RunId;
  readonly original: RunId;
  readonly workspaceId: WorkspaceId;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly block: StationBlock;
  readonly line: PlannedLine | null;
  readonly answer: OracleAnswer | null;
}

export type ReplayRunQueued =
  | { readonly queued: true; readonly fingerprint: StationFingerprint | null }
  | { readonly queued: false; readonly unreplayableReason: UnreplayableReason };

export type CancelledRun =
  | { readonly queued: false }
  | { readonly queued: true; readonly fingerprint: StationFingerprint | null };

export interface OracleAnswerInput {
  readonly run: RunId;
  readonly answer: OracleAnswer;
}

export interface ReplayRunDispatching {
  dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued>;

  cancel(run: RunId, leaveRunAsIs: boolean): Promise<CancelledRun>;

  cancelQueued(runs: readonly RunId[]): Promise<void>;

  answerable(inputs: readonly OracleAnswerInput[]): Promise<readonly RunId[]>;
}

export const REPLAY_RUN_POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: false,
  asks: 'recorded',
  listed: false,
  exclusive: false,
};

const CEILING_REACHED =
  'Replay reached its ceiling before a runner claimed the run.';

const STOPPED = 'Replay stopped before a runner claimed the run.';

const CLAIM_ATTEMPTS = 3;

const NEVER_QUEUED: CancelledRun = { queued: false };

const CANCELLED: ReplayRunQueued = {
  queued: false,
  unreplayableReason: 'cancelled',
};

const unqueuedOf = (claim: ReplayRunClaim): ReplayRunQueued => ({
  queued: false,
  unreplayableReason: claim.unreplayableReason ?? 'cancelled',
});

const orderOf = (
  run: RunId,
  trial: Extract<TrialOrdering, { ordered: true }>,
): RunOrderContract => ({
  ...trial.order,
  requester: {
    owner: 'replays',
    kind: 'replay',
    id: run.value,
    token: null,
    team: trial.team,
  },
  policy: REPLAY_RUN_POLICY,
  workspace: {
    key: workspaceKeyOf('replays', `replay-${run.value}`),
    rejoinable: false,
    restores: 'when-continuing',
  },
  extensions: {
    replay: {
      archive: trial.order.restore?.archive ?? null,
      checkouts: trial.checkouts.map((each) => ({
        path: each.path,
        commit: each.commit,
        repository: each.repository,
      })),
      movesOnAfter: [...trial.movesOnAfter],
    },
  },
  apiGrant: null,
  tags: {},
});

export class ReplayRunDispatch implements ReplayRunDispatching {
  constructor(
    private readonly claims: ReplayRunClaimRepository,
    private readonly trials: StationTrialsPort,
    private readonly runs: RunsPort,
  ) {}

  async dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued> {
    const claim = await this.claimed(ReplayRunClaim.toQueue(order.run));

    if (!claim.mayQueue) {
      return unqueuedOf(claim);
    }

    const trial = await this.trials.order({
      run: order.run,
      original: order.original,
      workspaceId: order.workspaceId,
      lineId: order.lineId,
      stationId: order.stationId,
      block: order.block.value,
      repositories: order.line?.repositories,
      answer: order.answer,
    });

    if (!trial.ordered) {
      const refused = await this.changed(order.run, (each) =>
        each.mayQueue
          ? each.unreplayable(trial.unreplayableReason, trial.reason)
          : each,
      );

      return unqueuedOf(refused);
    }

    const ordered = await this.changed(order.run, (each) =>
      each.mayQueue
        ? each.ordered({
            fingerprint: trial.fingerprint,
            movesOnAfter: trial.movesOnAfter,
          })
        : each,
    );

    if (!ordered.mayQueue) {
      await this.trials.withdraw(order.run);
      return unqueuedOf(ordered);
    }

    const enqueued = await this.runs.enqueue(orderOf(order.run, trial));

    if (!enqueued.enqueued) {
      await this.trials.withdraw(order.run);
      const refused = await this.changed(order.run, (each) =>
        each.mayQueue
          ? each.unreplayable('cannot-start', enqueued.reason)
          : each,
      );

      return unqueuedOf(refused);
    }

    if (!(await this.found(order.run)).mayQueue) {
      await this.runs.cancel(order.run);
      return CANCELLED;
    }

    return { queued: true, fingerprint: trial.fingerprint };
  }

  async cancel(run: RunId, leaveRunAsIs: boolean): Promise<CancelledRun> {
    const claim = await this.claimed(ReplayRunClaim.toCancel(run));

    if (!claim.mayQueue) {
      return NEVER_QUEUED;
    }

    if (leaveRunAsIs && (await this.runs.statuses([run])).length > 0) {
      return { queued: true, fingerprint: claim.trial?.fingerprint ?? null };
    }

    await this.changed(run, (each) => each.cancelled());

    if (leaveRunAsIs || !(await this.stopped(run))) {
      return NEVER_QUEUED;
    }

    return { queued: true, fingerprint: claim.trial?.fingerprint ?? null };
  }

  async cancelQueued(runs: readonly RunId[]): Promise<void> {
    for (const run of runs) {
      await this.runs.cancelIfQueued(run, CEILING_REACHED);
    }
  }

  async answerable(
    inputs: readonly OracleAnswerInput[],
  ): Promise<readonly RunId[]> {
    const answered: RunId[] = [];

    for (const each of inputs) {
      if ((await this.trials.answers(each.run)).includes(each.answer)) {
        answered.push(each.run);
      }
    }

    return answered;
  }

  private async stopped(run: RunId): Promise<boolean> {
    const cancelled = await this.runs.cancelIfQueued(run, STOPPED);

    switch (cancelled.outcome) {
      case 'claimed':
        return (await this.runs.cancel(run)).known;
      case 'unknown':
        return false;
      case 'cancelled':
      case 'ended':
        return true;
    }
  }

  private async claimed(first: ReplayRunClaim): Promise<ReplayRunClaim> {
    const known = await this.claims.find(first.runId);

    if (known) {
      return known;
    }

    try {
      await this.claims.add(first);
      return first;
    } catch (error) {
      if (!(error instanceof ReplayRunClaimVersionConflictError)) {
        throw error;
      }

      return this.found(first.runId);
    }
  }

  private async changed(
    run: RunId,
    change: (claim: ReplayRunClaim) => ReplayRunClaim,
  ): Promise<ReplayRunClaim> {
    for (let attempt = 1; ; attempt += 1) {
      const claim = await this.found(run);
      const next = change(claim);

      if (next === claim) {
        return claim;
      }

      try {
        await this.claims.save(next);
        return next;
      } catch (error) {
        if (
          !(error instanceof ReplayRunClaimVersionConflictError) ||
          attempt >= CLAIM_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  private async found(run: RunId): Promise<ReplayRunClaim> {
    const claim = await this.claims.find(run);

    if (!claim) {
      throw new InconsistentStateError(
        'replay run claim',
        `${run.value} is acted on before it was claimed`,
      );
    }

    return claim;
  }
}
