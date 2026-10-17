import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { UnreplayableReasonCode } from '@work/application/contracts/unreplayable-reason.contract';
import type {
  AnswerAsked,
  CancelledReplayRun,
  ReplayDispatched,
  ReplayDispatchPort,
  ReplayOrder,
} from '@work/application/ports/replay-dispatch.port';
import type { ReplayRunClaimsPort } from '@work/application/ports/replay-run-claims.port';
import type { CandidateLines } from '@work/application/services/candidate-lines.service';
import type { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import type { ReplayAnswers } from '@work/application/services/replay-answers.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { UnreplayableRunError } from '@work/domain/exceptions/unreplayable-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';

const OVER_BUDGET =
  'Replay reached its budget before a runner claimed the run.';
const STOPPED = 'Replay stopped before a runner claimed the run.';

const unreplayable = (
  unreplayableReason: UnreplayableReasonCode,
  reason: string,
): ReplayDispatched => ({
  outcome: 'unreplayable',
  unreplayableReason,
  reason,
});

export class ReplayRuns implements ReplayDispatchPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly claims: ReplayRunClaimsPort,
    private readonly candidates: CandidateLines,
    private readonly dispatch: DispatchReplay,
    private readonly answers: ReplayAnswers,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  enqueue(order: ReplayOrder): Promise<ReplayDispatched> {
    return this.transaction.inTransaction(async () => {
      const id = RunId.of(order.id);
      const original = RunId.of(order.original);
      const claim = await this.claims.claim(ReplayRunClaim.toQueue(id));

      if (!claim.mayQueue) {
        return claim.unreplayableReason
          ? unreplayable(
              claim.unreplayableReason,
              claim.reason ?? claim.unreplayableReason,
            )
          : unreplayable(
              'cancelled',
              'its replay cancelled it before it was queued',
            );
      }

      if (await this.dispatch.alreadyQueued(id, original)) {
        return this.queued(id);
      }

      const dispatched = await this.enqueued(order, id, original);

      if (dispatched.outcome === 'unreplayable') {
        await this.claims.save(
          claim.unreplayable(dispatched.unreplayableReason, dispatched.reason),
        );
      }

      return dispatched;
    });
  }

  async answerable(asked: readonly AnswerAsked[]): Promise<readonly string[]> {
    const answered: string[] = [];

    for (const each of asked) {
      const original = await this.runs.findById(RunId.of(each.original));

      if (original && (await this.answers.has(original, each.answer))) {
        answered.push(each.original);
      }
    }

    return answered;
  }

  cancelQueued(runIds: readonly string[]): Promise<void> {
    return this.each(runIds, (run) =>
      run.state === 'queued' ? run.cancelQueued(OVER_BUDGET) : run,
    );
  }

  cancel(runId: string, keep: boolean): Promise<CancelledReplayRun> {
    return this.transaction.inTransaction(async () => {
      const id = RunId.of(runId);
      const claim = await this.claims.claim(ReplayRunClaim.toCancel(id));

      if (!claim.mayQueue) {
        return { outcome: 'never-queued' as const };
      }

      const run = await this.runs.findById(id);
      const replayed = run?.replayOf ? run : null;
      const cancelledClaim = claim.cancelled(replayed !== null);

      if (!replayed) {
        await this.claims.save(cancelledClaim);
        return { outcome: 'never-queued' as const };
      }

      if (!keep) {
        await this.stopped(replayed);
      }

      return {
        outcome: 'queued' as const,
        fingerprint: replayed.configuredAs?.fingerprint ?? null,
      };
    });
  }

  private async enqueued(
    order: ReplayOrder,
    id: RunId,
    original: RunId,
  ): Promise<ReplayDispatched> {
    const replayed = await this.runs.findById(original);

    if (!replayed?.workspaceId.equals(WorkspaceId.of(order.workspaceId))) {
      return unreplayable('unknown-run', 'there is no such run');
    }

    const current = await this.candidates.live(order.lineId, order.stationId);

    if (!current) {
      return unreplayable(
        'not-at-the-station',
        'the line no longer has the station it worked at',
      );
    }

    const built = await this.candidates.withStation(
      current,
      order.station,
      order.repositories,
    );

    if (!built.ok) {
      return unreplayable(
        'candidate-unfit',
        'the candidate no longer fits the current line',
      );
    }

    try {
      await this.dispatch.enqueue({
        original,
        candidate: built.line,
        id,
        answer: order.answer ?? null,
      });
    } catch (error) {
      if (error instanceof UnreplayableRunError) {
        return unreplayable(error.unreplayableReason, error.message);
      }
      throw error;
    }

    return this.queued(id);
  }

  private async stopped(run: Run): Promise<void> {
    if (run.hasEnded) {
      return;
    }

    const changed =
      run.state === 'queued'
        ? run.cancelQueued(STOPPED)
        : run.cancel(this.clock.now());

    if (changed !== run) {
      await this.runs.save(changed);
    }
  }

  private async queued(id: RunId): Promise<ReplayDispatched> {
    const run = await this.runs.findById(id);

    return {
      outcome: 'queued',
      fingerprint: run?.configuredAs?.fingerprint ?? null,
    };
  }

  private async each(
    runIds: readonly string[],
    change: (run: Run) => Run,
  ): Promise<void> {
    for (const runId of runIds) {
      await this.transaction.inTransaction(async () => {
        const run = await this.runs.findById(RunId.of(runId));

        if (!run?.replayOf || run.hasEnded) {
          return;
        }

        const changed = change(run);

        if (changed !== run) {
          await this.runs.save(changed);
        }
      });
    }
  }
}
