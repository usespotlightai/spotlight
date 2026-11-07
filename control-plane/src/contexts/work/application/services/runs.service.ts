import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  canonicalOrder,
  type RunOrderContract,
} from '@work/application/contracts/run-order.contract';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { ContentHashPort } from '@work/application/ports/content-hash.port';
import type {
  QueuedRunCancellation,
  ResumedBecause,
  RunCancellation,
  RunEnqueueing,
  RunLease,
  RunsPort,
  StopRequest,
} from '@work/application/ports/runs.port';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunAlreadyExistsError } from '@work/domain/exceptions/run-already-exists.error';
import { RunOrderConflictError } from '@work/domain/exceptions/run-order-conflict.error';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import type { RunCheckout } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';

const SAVE_ATTEMPTS = 3;

const ENQUEUED: RunEnqueueing = { outcome: 'enqueued' };

const startedBefore = (run: Run): boolean => run.attempt > 1;

export class Runs implements RunsPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly hash: ContentHashPort,
    private readonly clock: ClockPort,
  ) {}

  async enqueue(order: RunOrderContract): Promise<RunEnqueueing> {
    const fingerprint = this.hash.sha256(canonicalOrder(order));
    const id = RunId.of(order.runId);

    if (await this.alreadyOrdered(id, fingerprint)) {
      return ENQUEUED;
    }

    const queued = this.queued(order, fingerprint);

    if (!(queued instanceof Run)) {
      return queued;
    }

    try {
      await this.runs.add(
        order.refusal
          ? queued.refused(RunOutcome.refused(order.refusal))
          : queued,
      );
    } catch (error) {
      if (
        !(error instanceof RunAlreadyExistsError) ||
        !(await this.alreadyOrdered(id, fingerprint))
      ) {
        throw error;
      }
    }

    return ENQUEUED;
  }

  private queued(
    order: RunOrderContract,
    fingerprint: string,
  ): Run | RunEnqueueing {
    try {
      return Run.enqueue({
        id: RunId.of(order.runId),
        workspaceId: WorkspaceId.of(order.workspaceId),
        harness: HarnessId.of(order.harness),
        priority: RunPriority.of(order.priority),
        subject: order.subject ? RunSubject.fromValues(order.subject) : null,
        placement: RunnerPlacement.ofLabelGroups(
          order.placement.labelGroups,
          order.placement.image ? RunnerImage.of(order.placement.image) : null,
        ),
        spec: RunSpecContract.received(order.spec),
        team: order.team ? TeamId.of(order.team) : null,
        orderFingerprint: fingerprint,
      });
    } catch (error) {
      if (error instanceof DomainError && error.kind === 'invalid') {
        return { outcome: 'refused', reason: error.message };
      }

      throw error;
    }
  }

  private async alreadyOrdered(
    id: RunId,
    fingerprint: string,
  ): Promise<boolean> {
    const known = await this.runs.findById(id);

    if (known && known.orderFingerprint !== fingerprint) {
      throw new RunOrderConflictError(id.value);
    }

    return known !== null;
  }

  async requestStop(runId: RunId): Promise<StopRequest> {
    const stopped = await this.changed(runId, (run) =>
      run.requestStop(this.clock.now()),
    );

    if (!stopped) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    return {
      pendingTurn: stopped.turnAt(stopped.attempt)?.pending
        ? stopped.attempt
        : null,
    };
  }

  async keep(runId: RunId, attempt: number): Promise<void> {
    await this.changed(runId, (run) => run.keep(attempt));
  }

  async resume(
    runId: RunId,
    attempt: number | null,
    because: ResumedBecause,
    checkouts: readonly RunCheckout[],
  ): Promise<void> {
    await this.changed(runId, (run) =>
      run.resumed(attempt, because, checkouts, this.clock.now()),
    );
  }

  async finish(runId: RunId, attempt: number): Promise<void> {
    await this.changed(runId, (run) => run.finished(attempt));
  }

  private async changed(
    runId: RunId,
    change: (run: Run) => Run,
  ): Promise<Run | null> {
    for (let attempt = 1; ; attempt++) {
      const run = await this.runs.findById(runId);

      if (!run) {
        return null;
      }

      const next = change(run);

      if (next === run) {
        return run;
      }

      try {
        await this.runs.save(next);
        return next;
      } catch (error) {
        if (
          !(error instanceof RunVersionConflictError) ||
          attempt >= SAVE_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  async cancel(runId: RunId): Promise<RunCancellation> {
    const run = await this.runs.findById(runId);

    if (!run) {
      return { was: 'unknown', started: false };
    }

    await this.changed(runId, (current) => current.cancel(this.clock.now()));

    return {
      was: run.hasEnded
        ? 'ended'
        : (run.state as Exclude<RunCancellation['was'], 'ended' | 'unknown'>),
      started: startedBefore(run),
    };
  }

  async cancelIfQueued(
    runId: RunId,
    reason: string,
  ): Promise<QueuedRunCancellation> {
    const run = await this.runs.findById(runId);

    if (!run) {
      return { outcome: 'unknown' };
    }

    if (run.hasEnded) {
      return { outcome: 'ended' };
    }

    if (run.state !== 'queued') {
      return { outcome: 'claimed' };
    }

    await this.runs.save(run.cancelQueued(reason));

    return { outcome: 'cancelled', started: startedBefore(run) };
  }

  async askedAPerson(lease: RunLease): Promise<void> {
    const run = await this.runs.findById(lease.runId);

    if (!run) {
      throw new UnknownRunError(`Run ${lease.runId.value} is not leased.`);
    }

    const asked = run.askedAPersonBy(lease.runner);

    if (asked !== run) {
      await this.runs.save(asked);
    }
  }
}
