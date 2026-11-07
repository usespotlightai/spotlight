import type { RunsPort } from '@replays/application/ports/runs.port';
import type { StationTrialsPort } from '@replays/application/ports/station-trials.port';
import { removeReplayRunDecision } from '@replays/application/services/replay-run-decision-removal';
import {
  ReplayRunDecision,
  type ReplayRunOwner,
} from '@replays/domain/aggregates/replay-run-decision.aggregate';
import { ReplayRunDecisionVersionConflictError } from '@replays/domain/exceptions/replay-run-decision-version-conflict.error';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';
import type { OracleAnswer } from '@replays/domain/services/oracle-answer';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface ReplayRunOrder {
  readonly run: RunId;
  readonly owner: ReplayRunOwner;
  readonly original: RunId;
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
  | { readonly wasQueued: false }
  | {
      readonly wasQueued: true;
      readonly fingerprint: StationFingerprint | null;
    };

export interface OracleAnswerInput {
  readonly run: RunId;
  readonly answer: OracleAnswer;
}

export interface ReplayRunDispatching {
  dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued>;

  cancel(
    run: RunId,
    owner: ReplayRunOwner,
    leaveRunAsIs: boolean,
  ): Promise<CancelledRun>;

  cancelQueued(runs: readonly RunId[]): Promise<void>;

  answerable(inputs: readonly OracleAnswerInput[]): Promise<readonly RunId[]>;
}

const CEILING_REACHED =
  'Replay reached its ceiling before a runner claimed the run.';

const STOPPED = 'Replay stopped before a runner claimed the run.';

const DECISION_ATTEMPTS = 3;

const NEVER_QUEUED: CancelledRun = { wasQueued: false };

const CANCELLED: ReplayRunQueued = {
  queued: false,
  unreplayableReason: 'cancelled',
};

const unqueuedOf = (decision: ReplayRunDecision | null): ReplayRunQueued =>
  decision
    ? {
        queued: false,
        unreplayableReason: decision.unreplayableReason ?? 'cancelled',
      }
    : CANCELLED;

const queuedOf = (decision: ReplayRunDecision): CancelledRun => ({
  wasQueued: true,
  fingerprint: decision.trial?.fingerprint ?? null,
});

export class ReplayRunDispatch implements ReplayRunDispatching {
  constructor(
    private readonly decisions: ReplayRunDecisionRepository,
    private readonly replays: Pick<ReplayRepository, 'find'>,
    private readonly trials: StationTrialsPort,
    private readonly runs: RunsPort,
  ) {}

  async dispatch(order: ReplayRunOrder): Promise<ReplayRunQueued> {
    const decision = await this.decidedWhileReplayExists(
      ReplayRunDecision.decidedToQueue(order.run, order.owner),
    );

    if (!decision) {
      return CANCELLED;
    }

    if (!decision.mayQueue) {
      return unqueuedOf(decision);
    }

    const ordering = await this.trials.order({
      run: order.run,
      original: order.original,
      workspaceId: order.owner.workspaceId,
      lineId: order.lineId,
      stationId: order.stationId,
      block: order.block,
      line: order.line,
      answer: order.answer,
    });

    if (!ordering.ordered) {
      return unqueuedOf(
        await this.changed(order.run, (each) =>
          each.unreplayable(ordering.unreplayableReason),
        ),
      );
    }

    const { trial } = ordering;
    const ordered = await this.changed(order.run, (each) =>
      each.ordered({
        fingerprint: trial.fingerprint,
        movesOnAfter: trial.movesOnAfter,
      }),
    );

    if (!ordered?.mayQueue) {
      await this.trials.withdraw(order.run);
      return unqueuedOf(ordered);
    }

    const enqueued = await this.runs.enqueueTrial({ run: order.run, trial });

    if (enqueued.outcome !== 'enqueued') {
      await this.trials.withdraw(order.run);

      return unqueuedOf(
        await this.changed(order.run, (each) =>
          each.unreplayable('cannot-start'),
        ),
      );
    }

    if (!(await this.decisions.find(order.run))?.mayQueue) {
      await this.runs.cancel(order.run, STOPPED);
      return CANCELLED;
    }

    return { queued: true, fingerprint: trial.fingerprint };
  }

  async cancel(
    run: RunId,
    owner: ReplayRunOwner,
    leaveRunAsIs: boolean,
  ): Promise<CancelledRun> {
    const decision = await this.decidedWhileReplayExists(
      ReplayRunDecision.decidedToCancel(run, owner),
    );

    if (!decision?.mayQueue) {
      return NEVER_QUEUED;
    }

    if (leaveRunAsIs && (await this.runs.statuses([run])).length > 0) {
      return queuedOf(decision);
    }

    await this.changed(run, (each) => each.cancelled());

    if (leaveRunAsIs || !(await this.stopped(run))) {
      await this.trials.withdraw(run);
      return NEVER_QUEUED;
    }

    return queuedOf(decision);
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

  private async abandoned(
    run: RunId,
    decision: ReplayRunDecision | null,
  ): Promise<void> {
    if (decision) {
      await removeReplayRunDecision(this.decisions, decision);
    }

    if (!(await this.stopped(run))) {
      await this.trials.withdraw(run);
    }
  }

  private async stopped(run: RunId): Promise<boolean> {
    const cancelled = await this.runs.cancelIfQueued(run, STOPPED);

    switch (cancelled.outcome) {
      case 'claimed':
        return (await this.runs.cancel(run, STOPPED)).known;
      case 'unknown':
        return false;
      case 'cancelled':
      case 'ended':
        return true;
    }
  }

  private async decidedWhileReplayExists(
    first: ReplayRunDecision,
  ): Promise<ReplayRunDecision | null> {
    if (!(await this.replays.find(first.owner.replayId))) {
      await this.abandoned(first.runId, await this.decisions.find(first.runId));
      return null;
    }

    const decision = await this.decidedFirst(first);

    if (!decision || !(await this.replays.find(first.owner.replayId))) {
      await this.abandoned(first.runId, decision);
      return null;
    }

    return decision;
  }

  private async decidedFirst(
    first: ReplayRunDecision,
  ): Promise<ReplayRunDecision | null> {
    const known = await this.decisions.find(first.runId);

    if (known) {
      return known;
    }

    try {
      await this.decisions.add(first);
      return first;
    } catch (error) {
      if (!(error instanceof ReplayRunDecisionVersionConflictError)) {
        throw error;
      }

      return this.decisions.find(first.runId);
    }
  }

  private async changed(
    run: RunId,
    change: (decision: ReplayRunDecision) => ReplayRunDecision,
  ): Promise<ReplayRunDecision | null> {
    for (let attempt = 1; ; attempt += 1) {
      const decision = await this.decisions.find(run);

      if (!decision) {
        return null;
      }

      const next = change(decision);

      if (next === decision) {
        return decision;
      }

      try {
        await this.decisions.save(next);
        return next;
      } catch (error) {
        if (
          !(error instanceof ReplayRunDecisionVersionConflictError) ||
          attempt >= DECISION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
