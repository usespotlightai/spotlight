import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type {
  CheckClaimant,
  StackCheckRepository,
} from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  CheckClaim,
  MAX_CHECK_ATTEMPTS,
  MAX_LEASE_MS,
} from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import {
  parseStoredSkip,
  WAITING_LIMIT_MS,
} from '@change-review/domain/value-objects/stack-check.vo';
import {
  checkedStepOf,
  entryOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import { stackCheck } from '@change-review/infrastructure/persistence/drizzle/schemas/stack-check.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { placementMatches } from '@platform/persistence/drizzle/placement-matches';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, desc, eq, gt, gte, isNull, lt, lte, or } from 'drizzle-orm';

type Row = typeof stackCheck.$inferSelect;

const toStackCheck = (row: Row): StackCheck =>
  StackCheck.rehydrate({
    stackId: ChangeStackId.of(row.stackId),
    runId: RunId.of(row.runId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    replay: row.replay,
    recheck: row.recheck,
    workspaceId: WorkspaceId.of(row.workspaceId),
    request: CheckRequest.of(
      row.command,
      row.setup,
      RunnerPlacement.ofLabelGroups(
        row.placement,
        row.placementImage ? RunnerImage.of(row.placementImage) : null,
      ),
    ),
    status: row.status,
    entries: row.entries.map(entryOf),
    redraftCount: row.redraftCount,
    outcome: row.outcome && {
      status: row.outcome.status,
      skip: row.outcome.skip
        ? parseStoredSkip(row.outcome.skip.code, row.outcome.skip.detail)
        : null,
      whole: row.outcome.whole && checkedStepOf(row.outcome.whole),
      layers: row.outcome.layers.map(checkedStepOf),
      checkedAt: new Date(row.outcome.checkedAt),
    },
    claim: CheckClaim.rehydrate({
      claimedBy: row.claimedBy ? RunnerId.of(row.claimedBy) : null,
      attempts: row.attempts,
      leaseExpiresAt: row.leaseExpiresAt,
      claimedAt: row.claimedAt,
    }),
    waitingSince: row.waitingSince,
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
    version: row.version,
  });

const valuesOf = (check: StackCheck) => ({
  status: check.status,
  entries: check.entries.map((entry) => ({
    hunk: entry.hunk,
    layer: entry.layer,
  })),
  redraftCount: check.redraftCount,
  outcome: check.outcome && {
    status: check.outcome.status,
    skip: check.outcome.skip ? { ...check.outcome.skip } : null,
    whole: check.outcome.whole && { ...check.outcome.whole },
    layers: check.outcome.layers.map((each) => ({ ...each })),
    checkedAt: check.outcome.checkedAt.toISOString(),
  },
  claimedBy: check.claim.claimedBy?.value ?? null,
  attempts: check.claim.attempts,
  leaseExpiresAt: check.claim.leaseExpiresAt,
  claimedAt: check.claim.claimedAt,
  waitingSince: check.waitingSince,
  reservedFor: check.reservation?.runner.value ?? null,
  reservedPool: check.reservation?.pool.value ?? null,
  reservedUntil: check.reservation?.until ?? null,
  provisionAttempts: check.provisioning.attempts,
  nextProvisionAttemptAt: check.provisioning.nextAttemptAt,
});

@Injectable()
export class DrizzleStackCheckRepository implements StackCheckRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: StackCheck): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db
        .insert(stackCheck)
        .values({
          stackId: added.stackId.value,
          recheck: added.recheck,
          runId: added.runId.value,
          taskId: added.taskId?.value ?? null,
          replay: added.replay,
          workspaceId: added.workspaceId.value,
          command: added.request.command,
          setup: added.request.setup,
          placement: added.request.placement.labelGroups,
          placementImage: added.request.placement.image?.value ?? null,
          version: added.version,
          ...valuesOf(added),
        })
        .onConflictDoNothing();

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: StackCheck): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(stackCheck)
        .set({ version: saved.version + 1, ...valuesOf(saved) })
        .where(
          and(
            eq(stackCheck.stackId, saved.stackId.value),
            eq(stackCheck.recheck, saved.recheck),
            eq(stackCheck.version, saved.version),
          ),
        )
        .returning({ stackId: stackCheck.stackId });

      if (written.length === 0) {
        throw new StackCheckVersionConflictError(saved.stackId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(
    stackId: ChangeStackId,
    recheck: boolean,
  ): Promise<StackCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.stackId, stackId.value),
          eq(stackCheck.recheck, recheck),
        ),
      )
      .limit(1);

    return row ? toStackCheck(row) : null;
  }

  async open(stackId: ChangeStackId): Promise<StackCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(stackCheck)
      .where(eq(stackCheck.stackId, stackId.value))
      .orderBy(desc(stackCheck.recheck))
      .limit(1);

    return row ? toStackCheck(row) : null;
  }

  async ofRun(runId: RunId): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(eq(stackCheck.runId, runId.value));

    return rows.map(toStackCheck);
  }

  async ofTask(taskId: TaskId): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(eq(stackCheck.taskId, taskId.value));

    return rows.map(toStackCheck);
  }

  async remove(removed: StackCheck): Promise<void> {
    await this.context.inTransaction(async () => {
      const deleted = await this.context.db
        .delete(stackCheck)
        .where(
          and(
            eq(stackCheck.stackId, removed.stackId.value),
            eq(stackCheck.recheck, removed.recheck),
            eq(stackCheck.version, removed.version),
          ),
        )
        .returning({ stackId: stackCheck.stackId });

      if (deleted.length === 0) {
        throw new StackCheckVersionConflictError(removed.stackId.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async dueForCheck(by: CheckClaimant, now: Date): Promise<StackCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.workspaceId, by.workspaceId.value),
          eq(stackCheck.status, 'waiting'),
          gte(
            stackCheck.waitingSince,
            new Date(now.getTime() - WAITING_LIMIT_MS),
          ),
          or(
            isNull(stackCheck.leaseExpiresAt),
            lte(stackCheck.leaseExpiresAt, now),
          ),
          lt(stackCheck.attempts, MAX_CHECK_ATTEMPTS),
          or(
            isNull(stackCheck.reservedFor),
            eq(stackCheck.reservedFor, by.runner.value),
            lte(stackCheck.reservedUntil, now),
          ),
          placementMatches(
            stackCheck.placement,
            stackCheck.placementImage,
            by.offer,
          ),
        ),
      )
      .orderBy(asc(stackCheck.waitingSince))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toStackCheck(row) : null;
  }

  async reservedTo(runner: RunnerId, now: Date): Promise<StackCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.status, 'waiting'),
          eq(stackCheck.reservedFor, runner.value),
          gt(stackCheck.reservedUntil, now),
        ),
      )
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toStackCheck(row) : null;
  }

  async awaitingProvision(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly skip: number; readonly max: number },
  ): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.workspaceId, workspaceId.value),
          eq(stackCheck.status, 'waiting'),
          gte(
            stackCheck.waitingSince,
            new Date(now.getTime() - WAITING_LIMIT_MS),
          ),
          isNull(stackCheck.reservedFor),
          or(
            isNull(stackCheck.leaseExpiresAt),
            lte(stackCheck.leaseExpiresAt, now),
          ),
          lt(stackCheck.attempts, MAX_CHECK_ATTEMPTS),
          or(
            isNull(stackCheck.nextProvisionAttemptAt),
            lte(stackCheck.nextProvisionAttemptAt, now),
          ),
        ),
      )
      .orderBy(
        asc(stackCheck.waitingSince),
        asc(stackCheck.stackId),
        asc(stackCheck.recheck),
      )
      .limit(page.max)
      .offset(page.skip);

    return rows.map(toStackCheck);
  }

  async withExpiredWait(
    now: Date,
    max: number,
  ): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.status, 'waiting'),
          lte(
            stackCheck.waitingSince,
            new Date(now.getTime() - WAITING_LIMIT_MS),
          ),
          or(
            isNull(stackCheck.leaseExpiresAt),
            lte(stackCheck.leaseExpiresAt, now),
            lte(stackCheck.claimedAt, new Date(now.getTime() - MAX_LEASE_MS)),
          ),
        ),
      )
      .orderBy(asc(stackCheck.waitingSince))
      .limit(max);

    return rows.map(toStackCheck);
  }

  async withExpiredReservations(now: Date): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.status, 'waiting'),
          lte(stackCheck.reservedUntil, now),
        ),
      );

    return rows.map(toStackCheck);
  }

  async waitingIn(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.workspaceId, workspaceId.value),
          eq(stackCheck.status, 'waiting'),
          gte(
            stackCheck.waitingSince,
            new Date(now.getTime() - WAITING_LIMIT_MS),
          ),
        ),
      );

    return rows.map(toStackCheck).filter((each) => each.claimableAt(now));
  }
}
