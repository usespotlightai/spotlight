import type { RunOrderContract } from '@runs/application/contracts/run-order.contract';
import { RunSpecMapper } from '@runs/application/mappers/run-spec.mapper';
import type { ContentHashPort } from '@runs/application/ports/content-hash.port';
import type {
  QueuedRunCancellation,
  ResumedBecause,
  RunCancellation,
  RunEnqueueing,
  RunLease,
  RunsPort,
  StopRequest,
} from '@runs/application/ports/runs.port';
import { canonicalOrder } from '@runs/application/services/canonical-order';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { InvalidRunOrderError } from '@runs/domain/exceptions/invalid-run-order.error';
import { InvalidRunSpecError } from '@runs/domain/exceptions/invalid-run-spec.error';
import { RunAlreadyExistsError } from '@runs/domain/exceptions/run-already-exists.error';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { RunApiGrant } from '@runs/domain/value-objects/run-api-grant.vo';
import { RunExtensions } from '@runs/domain/value-objects/run-extensions.vo';
import { RunPolicy } from '@runs/domain/value-objects/run-policy.vo';
import { RunPriority } from '@runs/domain/value-objects/run-priority.vo';
import { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import type { RunCheckout } from '@runs/domain/value-objects/run-spec.vo';
import { RunTags } from '@runs/domain/value-objects/run-tags.vo';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import {
  RunWorkspace,
  WorkspaceKey,
} from '@runs/domain/value-objects/workspace-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const SAVE_ATTEMPTS = 3;

const ENQUEUED: RunEnqueueing = { outcome: 'enqueued' };

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
      await this.runs.add(queued);
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
        requester: RunRequester.of({
          ...order.requester,
          team: order.requester.team ? TeamId.of(order.requester.team) : null,
        }),
        policy: RunPolicy.of(order.policy),
        workspace: order.workspace
          ? RunWorkspace.of({
              key: WorkspaceKey.parse(order.workspace.key),
              rejoinable: order.workspace.rejoinable,
              restores: order.workspace.restores,
            })
          : null,
        restore: order.restore
          ? WorkspaceArchiveId.of(order.restore.archive)
          : null,
        extensions: RunExtensions.of(order.extensions),
        tags: RunTags.of(order.tags),
        apiGrant: order.apiGrant ? RunApiGrant.of(order.apiGrant) : null,
        placement: RunnerPlacement.ofLabelGroups(
          order.placement.labelGroups,
          order.placement.image ? RunnerImage.of(order.placement.image) : null,
        ),
        spec: RunSpecMapper.received(order.spec),
        orderFingerprint: fingerprint,
        refusal: order.refusal,
        now: this.clock.now(),
      });
    } catch (error) {
      if (
        error instanceof InvalidRunOrderError ||
        error instanceof InvalidRunSpecError
      ) {
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

    return known?.reordered(fingerprint) !== undefined;
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
    await this.changed(runId, (run) => run.keep(attempt, this.clock.now()));
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
    const changed = await this.decided(runId, (run) => ({ run: change(run) }));

    return changed?.run ?? null;
  }

  private async decided<T extends { readonly run: Run }>(
    runId: RunId,
    decide: (run: Run) => T,
  ): Promise<T | null> {
    for (let attempt = 1; ; attempt++) {
      const run = await this.runs.findById(runId);

      if (!run) {
        return null;
      }

      const decision = decide(run);

      if (decision.run === run) {
        return decision;
      }

      try {
        await this.runs.save(decision.run);
        return decision;
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

  async cancel(runId: RunId, reason: string): Promise<RunCancellation> {
    const cancelled = await this.decided(runId, (run) =>
      run.cancel(reason, this.clock.now()),
    );

    return cancelled
      ? { was: cancelled.was, started: cancelled.started }
      : { was: 'unknown', started: false };
  }

  async cancelIfQueued(
    runId: RunId,
    reason: string,
  ): Promise<QueuedRunCancellation> {
    const cancelled = await this.decided(runId, (run) =>
      run.cancelledIfQueued(reason, this.clock.now()),
    );

    if (!cancelled) {
      return { outcome: 'unknown' };
    }

    return cancelled.outcome === 'cancelled'
      ? { outcome: 'cancelled', started: cancelled.started }
      : { outcome: cancelled.outcome };
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
