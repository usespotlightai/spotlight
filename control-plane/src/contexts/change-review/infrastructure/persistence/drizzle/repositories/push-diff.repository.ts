import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { PushAlreadyWaitingError } from '@change-review/domain/exceptions/push-already-waiting.error';
import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import { RunnerClaim } from '@change-review/domain/value-objects/runner-claim.vo';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { pushDiff } from '@change-review/infrastructure/persistence/drizzle/schemas/push-diff.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

const isHeadWaiting = (error: unknown): boolean =>
  violates(error, UNIQUE_VIOLATION, 'push_diff_waiting_head_idx');

type Row = typeof pushDiff.$inferSelect;

const commitOf = (raw: string): CommitSha => {
  const sha = CommitSha.parsed(raw);

  if (!sha) {
    throw new InconsistentStateError('push diff', `names commit ${raw}`);
  }

  return sha;
};

const toPushDiff = (row: Row): PushDiff =>
  PushDiff.rehydrate({
    id: PushDiffId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: TaskId.of(row.taskId),
    pullRequest: PullRequestUrl.of(row.pullRequest),
    repository: RepositoryName.of(row.repository),
    push: {
      head: commitOf(row.head),
      baseTip: commitOf(row.baseTip),
      pushedBy: Pusher.of(row.pushedBy),
      pushedAt: row.pushedAt,
    },
    placement: RunnerPlacement.ofLabelGroups(
      row.placement,
      row.placementImage ? RunnerImage.of(row.placementImage) : null,
    ),
    status: row.status,
    failure: row.failure,
    claim: RunnerClaim.rehydrate({
      claimedBy: row.claimedBy ? RunnerId.of(row.claimedBy) : null,
      attempts: row.attempts,
      leaseExpiresAt: row.leaseExpiresAt,
      claimedAt: row.claimedAt,
    }),
    reservation:
      row.reservedFor && row.reservedPool && row.reservedUntil
        ? RunnerReservation.of(
            RunnerId.of(row.reservedFor),
            PoolId.of(row.reservedPool),
            row.reservedUntil,
          )
        : null,
    provisioning: Provisioning.rehydrate(
      row.provisionAttempts,
      row.nextProvisionAttemptAt,
    ),
    recordedAt: row.recordedAt,
    version: row.version,
  });

const valuesOf = (diff: PushDiff) => ({
  status: diff.status,
  failure: diff.failure,
  claimedBy: diff.claim.claimedBy?.value ?? null,
  attempts: diff.claim.attempts,
  leaseExpiresAt: diff.claim.leaseExpiresAt,
  claimedAt: diff.claim.claimedAt,
  reservedFor: diff.reservation?.runner.value ?? null,
  reservedPool: diff.reservation?.pool.value ?? null,
  reservedUntil: diff.reservation?.until ?? null,
  provisionAttempts: diff.provisioning.attempts,
  nextProvisionAttemptAt: diff.provisioning.nextAttemptAt,
});

@Injectable()
export class DrizzlePushDiffRepository implements PushDiffRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: PushDiff): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: PushDiff): Promise<void> {
    try {
      await this.context.db.insert(pushDiff).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        taskId: added.taskId.value,
        pullRequest: added.pullRequest.value,
        repository: added.repository.value,
        head: added.push.head.value,
        baseTip: added.push.baseTip.value,
        pushedBy: added.push.pushedBy?.value ?? null,
        pushedAt: added.push.pushedAt,
        placement: added.placement.labelGroups,
        placementImage: added.placement.image?.value ?? null,
        recordedAt: added.recordedAt,
        version: added.version,
        ...valuesOf(added),
      });
    } catch (error) {
      throw isHeadWaiting(error)
        ? new PushAlreadyWaitingError(added.push.head)
        : error;
    }
  }

  async save(saved: PushDiff): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(pushDiff)
        .set({ version: saved.version + 1, ...valuesOf(saved) })
        .where(
          and(eq(pushDiff.id, saved.id.value), eq(pushDiff.version, saved.version)),
        )
        .returning({ id: pushDiff.id });

      if (written.length === 0) {
        throw new PushDiffVersionConflictError(saved.id);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: PushDiffId): Promise<PushDiff | null> {
    const [row] = await this.context.db
      .select()
      .from(pushDiff)
      .where(eq(pushDiff.id, id.value))
      .limit(1);

    return row ? toPushDiff(row) : null;
  }

  async waitingIn(workspaceId: WorkspaceId): Promise<readonly PushDiff[]> {
    const rows = await this.context.db
      .select()
      .from(pushDiff)
      .where(
        and(
          eq(pushDiff.workspaceId, workspaceId.value),
          eq(pushDiff.status, 'waiting'),
        ),
      )
      .orderBy(asc(pushDiff.recordedAt));

    return rows.map(toPushDiff);
  }

  async workspacesWaiting(): Promise<readonly WorkspaceId[]> {
    const rows = await this.context.db
      .selectDistinct({ workspaceId: pushDiff.workspaceId })
      .from(pushDiff)
      .where(eq(pushDiff.status, 'waiting'));

    return rows.map((row) => WorkspaceId.of(row.workspaceId));
  }

  async reserved(): Promise<readonly PushDiff[]> {
    const rows = await this.context.db
      .select()
      .from(pushDiff)
      .where(isNotNull(pushDiff.reservedFor));

    return rows.map(toPushDiff);
  }

  async reservedFor(runner: RunnerId): Promise<readonly PushDiff[]> {
    const rows = await this.context.db
      .select()
      .from(pushDiff)
      .where(eq(pushDiff.reservedFor, runner.value));

    return rows.map(toPushDiff);
  }

  async waiting(): Promise<readonly PushDiff[]> {
    const rows = await this.context.db
      .select()
      .from(pushDiff)
      .where(eq(pushDiff.status, 'waiting'))
      .orderBy(asc(pushDiff.recordedAt));

    return rows.map(toPushDiff);
  }

  async ofTask(taskId: TaskId): Promise<readonly PushDiff[]> {
    const rows = await this.context.db
      .select()
      .from(pushDiff)
      .where(eq(pushDiff.taskId, taskId.value))
      .orderBy(asc(pushDiff.recordedAt));

    return rows.map(toPushDiff);
  }

  async remove(removed: PushDiff): Promise<void> {
    await this.context.inTransaction(async () => {
      const deleted = await this.context.db
        .delete(pushDiff)
        .where(
          and(
            eq(pushDiff.id, removed.id.value),
            eq(pushDiff.version, removed.version),
          ),
        )
        .returning({ id: pushDiff.id });

      if (deleted.length === 0) {
        throw new PushDiffVersionConflictError(removed.id);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }
}
