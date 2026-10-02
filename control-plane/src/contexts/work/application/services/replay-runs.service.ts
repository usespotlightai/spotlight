import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ReplayRefusalCode } from '@work/application/contracts/replay-refusal.contract';
import type {
  ReplayDispatched,
  ReplayDispatchPort,
  ReplayForgone,
  ReplayOrder,
} from '@work/application/ports/replay-dispatch.port';
import type { ReplayRunClaimsPort } from '@work/application/ports/replay-run-claims.port';
import type { CandidateLines } from '@work/application/services/candidate-lines.service';
import type { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { UnreplayableRunError } from '@work/domain/exceptions/unreplayable-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';

const OVER_BUDGET =
  'Its replay spent what it was allowed before a runner took it up.';
const STOPPED = 'Its replay was stopped before a runner took it up.';

const unreplayable = (
  refusal: ReplayRefusalCode,
  reason: string,
): ReplayDispatched => ({ outcome: 'unreplayable', refusal, reason });

export class ReplayRuns implements ReplayDispatchPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly claims: ReplayRunClaimsPort,
    private readonly candidates: CandidateLines,
    private readonly dispatch: DispatchReplay,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  enqueue(order: ReplayOrder): Promise<ReplayDispatched> {
    return this.transaction.run(async () => {
      const id = RunId.of(order.id);
      const original = RunId.of(order.original);
      const claim = await this.claims.claim(ReplayRunClaim.toQueue(id));

      if (!claim.mayQueue) {
        return claim.refusal
          ? unreplayable(claim.refusal, claim.reason ?? claim.refusal)
          : unreplayable(
              'forgone',
              'its replay let it go before it was queued',
            );
      }

      if (await this.dispatch.alreadyQueued(id, original)) {
        return this.queued(id);
      }

      const dispatched = await this.enqueued(order, id, original);

      if (dispatched.outcome === 'unreplayable') {
        await this.claims.save(
          claim.refused(dispatched.refusal, dispatched.reason),
        );
      }

      return dispatched;
    });
  }

  withdraw(runIds: readonly string[]): Promise<void> {
    return this.each(runIds, (run) =>
      run.state === 'queued' ? run.withdrawn(OVER_BUDGET) : run,
    );
  }

  forgo(runId: string, keep: boolean): Promise<ReplayForgone> {
    return this.transaction.run(async () => {
      const id = RunId.of(runId);
      const claim = await this.claims.claim(ReplayRunClaim.toForgo(id));

      if (!claim.mayQueue) {
        return { outcome: 'never-queued' as const };
      }

      const run = await this.runs.findById(id);
      const replayed = run?.replayOf ? run : null;
      const settled = claim.forgone(replayed !== null);

      if (!replayed) {
        await this.claims.save(settled);
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

    const standing = await this.candidates.standing(
      order.lineId,
      order.stationId,
    );

    if (!standing) {
      return unreplayable(
        'not-at-the-station',
        'the line no longer has the station it worked at',
      );
    }

    const built = await this.candidates.withStation(
      standing,
      order.station,
      order.repositories,
    );

    if (!built.ok) {
      return unreplayable(
        'candidate-unfit',
        'the candidate no longer fits the line as it stands',
      );
    }

    try {
      await this.dispatch.enqueue({ original, candidate: built.line, id });
    } catch (error) {
      if (error instanceof UnreplayableRunError) {
        return unreplayable(error.refusal, error.message);
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
        ? run.withdrawn(STOPPED)
        : run.letGo(this.clock.now());

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
      await this.transaction.run(async () => {
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
