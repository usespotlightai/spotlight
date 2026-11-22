import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { RunnerClaim } from '@change-review/domain/value-objects/runner-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { RepositoryStack } from '@change-review/domain/value-objects/repository-stack.vo';
import { parseStoredSkip } from '@change-review/domain/value-objects/stack-check.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import {
  checkedStepOf,
  entryOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import { stackCheck } from '@change-review/infrastructure/persistence/drizzle/schemas/stack-check.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
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
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNotNull, isNull, lte, or } from 'drizzle-orm';

type Row = typeof stackCheck.$inferSelect;

export const toStackCheck = (row: Row): StackCheck =>
  StackCheck.rehydrate({
    id: StackCheckId.of(ChangeStackId.of(row.stackId), row.recheck),
    runId: row.runId ? RunId.of(row.runId) : null,
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    teamId: row.teamId ? TeamId.of(row.teamId) : null,
    trial: row.trial,
    workspaceId: WorkspaceId.of(row.workspaceId),
    request: CheckRequest.of(
      row.command,
      row.setup,
      RunnerPlacement.ofLabelGroups(
        row.placement,
        row.placementImage ? RunnerImage.of(row.placementImage) : null,
      ),
    ),
    stack: RepositoryStack.of({
      repository: RepositoryName.optional(row.repository),
      startedAt: row.stackStartedAt,
    }),
    status: row.status,
    entries: row.entries.map(entryOf),
    redraftCount: row.redraftCount,
    outcome: row.outcome && {
      status: row.outcome.status,
      skip: row.outcome.skip
        ? parseStoredSkip(
            row.outcome.skip.code,
            row.outcome.skip.detail,
            row.outcome.skip.attempts ?? null,
          )
        : null,
      whole: row.outcome.whole && checkedStepOf(row.outcome.whole),
      layers: row.outcome.layers.map(checkedStepOf),
      checkedAt: new Date(row.outcome.checkedAt),
    },
    claim: RunnerClaim.rehydrate({
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
      await this.context.db.insert(stackCheck).values({
        stackId: added.stackId.value,
        recheck: added.recheck,
        runId: added.runId?.value ?? null,
        taskId: added.taskId?.value ?? null,
        teamId: added.teamId?.value ?? null,
        trial: added.trial,
        workspaceId: added.workspaceId.value,
        command: added.request.command,
        setup: added.request.setup,
        placement: added.request.placement.labelGroups,
        placementImage: added.request.placement.image?.value ?? null,
        repository: added.stack.repository?.value ?? null,
        stackStartedAt: added.stack.startedAt,
        version: added.version,
        ...valuesOf(added),
      });

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
        throw new StackCheckVersionConflictError(saved.id);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: StackCheckId): Promise<StackCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.stackId, id.stackId.value),
          eq(stackCheck.recheck, id.recheck),
        ),
      )
      .limit(1);

    return row ? toStackCheck(row) : null;
  }

  async ofStack(stackId: ChangeStackId): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(eq(stackCheck.stackId, stackId.value));

    return rows.map(toStackCheck);
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

  async ofTeam(teamId: TeamId): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(eq(stackCheck.teamId, teamId.value));

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
        throw new StackCheckVersionConflictError(removed.id);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async waiting(): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(eq(stackCheck.status, 'waiting'))
      .orderBy(
        asc(stackCheck.waitingSince),
        asc(stackCheck.stackId),
        asc(stackCheck.recheck),
      );

    return rows.map(toStackCheck);
  }

  async waitingIn(workspaceId: WorkspaceId): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.workspaceId, workspaceId.value),
          eq(stackCheck.status, 'waiting'),
        ),
      )
      .orderBy(
        asc(stackCheck.waitingSince),
        asc(stackCheck.stackId),
        asc(stackCheck.recheck),
      );

    return rows.map(toStackCheck);
  }

  async workspacesWaiting(now: Date): Promise<readonly WorkspaceId[]> {
    const rows = await this.context.db
      .selectDistinct({ workspaceId: stackCheck.workspaceId })
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.status, 'waiting'),
          isNull(stackCheck.reservedFor),
          or(
            isNull(stackCheck.nextProvisionAttemptAt),
            lte(stackCheck.nextProvisionAttemptAt, now),
          ),
        ),
      );

    return rows.map((row) => WorkspaceId.of(row.workspaceId));
  }

  async reserved(): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.status, 'waiting'),
          isNotNull(stackCheck.reservedFor),
        ),
      );

    return rows.map(toStackCheck);
  }

  async reservedFor(runner: RunnerId): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.status, 'waiting'),
          eq(stackCheck.reservedFor, runner.value),
        ),
      )
      .orderBy(asc(stackCheck.waitingSince));

    return rows.map(toStackCheck);
  }
}
