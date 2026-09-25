import {
  StackCheck,
  WAITING_LIMIT_MS,
} from '@change-review/domain/aggregates/stack-check.aggregate';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type {
  CheckClaimant,
  StackCheckRepository,
} from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  CheckClaim,
  MOST_CHECK_ATTEMPTS,
} from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { keptSkipOf } from '@change-review/domain/value-objects/stack-check.vo';
import {
  checkedStepOf,
  entryOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import { stackCheck } from '@change-review/infrastructure/persistence/drizzle/schemas/stack-check.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { placementMet } from '@platform/persistence/drizzle/placement-met';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerReservation } from '@shared-kernel/domain/value-objects/runner-reservation.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, gt, inArray, isNull, lt, lte, or } from 'drizzle-orm';

type Row = typeof stackCheck.$inferSelect;

const toStackCheck = (row: Row): StackCheck =>
  StackCheck.rehydrate({
    stackId: ChangeStackId.of(row.stackId),
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    request: CheckRequest.of(
      row.command,
      row.setup,
      RunnerPlacement.ofClauses(
        row.placement,
        row.placementImage ? RunnerImage.of(row.placementImage) : null,
      ),
    ),
    phase: row.phase,
    entries: row.entries.map(entryOf),
    rounds: row.rounds,
    outcome: row.outcome && {
      state: row.outcome.state,
      skip: row.outcome.skip
        ? keptSkipOf(row.outcome.skip.code, row.outcome.skip.detail)
        : null,
      whole: row.outcome.whole && checkedStepOf(row.outcome.whole),
      layers: row.outcome.layers.map(checkedStepOf),
      checkedAt: new Date(row.outcome.checkedAt),
    },
    claim: CheckClaim.rehydrate({
      claimedBy: row.claimedBy ? RunnerId.of(row.claimedBy) : null,
      attempts: row.attempts,
      leaseExpiresAt: row.leaseExpiresAt,
    }),
    waitingSince: row.waitingSince,
    reservation:
      row.reservedFor && row.reservedPool && row.reservedUntil
        ? RunnerReservation.of(
            RunnerId.of(row.reservedFor),
            row.reservedPool,
            row.reservedUntil,
          )
        : null,
    provisioning: Provisioning.rehydrate(
      row.provisionFailures,
      row.nextProvisionAt,
    ),
    version: row.version,
  });

const valuesOf = (check: StackCheck) => ({
  phase: check.phase,
  entries: check.entries.map((entry) => ({
    hunk: entry.hunk,
    layer: entry.layer,
  })),
  rounds: check.rounds,
  outcome: check.outcome && {
    state: check.outcome.state,
    skip: check.outcome.skip ? { ...check.outcome.skip } : null,
    whole: check.outcome.whole && { ...check.outcome.whole },
    layers: check.outcome.layers.map((each) => ({ ...each })),
    checkedAt: check.outcome.checkedAt.toISOString(),
  },
  claimedBy: check.claim.claimedBy?.value ?? null,
  attempts: check.claim.attempts,
  leaseExpiresAt: check.claim.leaseExpiresAt,
  waitingSince: check.waitingSince,
  reservedFor: check.reservation?.runner.value ?? null,
  reservedPool: check.reservation?.pool ?? null,
  reservedUntil: check.reservation?.until ?? null,
  provisionFailures: check.provisioning.failures,
  nextProvisionAt: check.provisioning.nextAt,
});

@Injectable()
export class DrizzleStackCheckRepository implements StackCheckRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: StackCheck): Promise<void> {
    await this.context.run(async () => {
      await this.context.db
        .insert(stackCheck)
        .values({
          stackId: added.stackId.value,
          runId: added.runId.value,
          workspaceId: added.workspaceId.value,
          command: added.request.command,
          setup: added.request.setup,
          placement: added.request.placement.clauses,
          placementImage: added.request.placement.image?.value ?? null,
          version: added.version,
          ...valuesOf(added),
        })
        .onConflictDoNothing();

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: StackCheck): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .update(stackCheck)
        .set({ version: saved.version + 1, ...valuesOf(saved) })
        .where(
          and(
            eq(stackCheck.stackId, saved.stackId.value),
            eq(stackCheck.version, saved.version),
          ),
        )
        .returning({ stackId: stackCheck.stackId });

      if (written.length === 0) {
        throw new ChangedSinceReadError(
          'change stack check',
          saved.stackId.value,
        );
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(stackId: ChangeStackId): Promise<StackCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(stackCheck)
      .where(eq(stackCheck.stackId, stackId.value))
      .limit(1);

    return row ? toStackCheck(row) : null;
  }

  async dueForCheck(by: CheckClaimant, now: Date): Promise<StackCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.workspaceId, by.workspaceId.value),
          eq(stackCheck.phase, 'waiting'),
          gt(
            stackCheck.waitingSince,
            new Date(now.getTime() - WAITING_LIMIT_MS),
          ),
          or(
            isNull(stackCheck.leaseExpiresAt),
            lte(stackCheck.leaseExpiresAt, now),
          ),
          lt(stackCheck.attempts, MOST_CHECK_ATTEMPTS),
          or(
            isNull(stackCheck.reservedFor),
            eq(stackCheck.reservedFor, by.runner.value),
            lte(stackCheck.reservedUntil, now),
          ),
          placementMet(
            stackCheck.placement,
            stackCheck.placementImage,
            by.terms,
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
          eq(stackCheck.phase, 'waiting'),
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
    page: { readonly skip: number; readonly most: number },
  ): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.workspaceId, workspaceId.value),
          eq(stackCheck.phase, 'waiting'),
          gt(
            stackCheck.waitingSince,
            new Date(now.getTime() - WAITING_LIMIT_MS),
          ),
          isNull(stackCheck.reservedFor),
          or(
            isNull(stackCheck.leaseExpiresAt),
            lte(stackCheck.leaseExpiresAt, now),
          ),
          lt(stackCheck.attempts, MOST_CHECK_ATTEMPTS),
          or(
            isNull(stackCheck.nextProvisionAt),
            lte(stackCheck.nextProvisionAt, now),
          ),
        ),
      )
      .orderBy(asc(stackCheck.waitingSince), asc(stackCheck.stackId))
      .limit(page.most)
      .offset(page.skip);

    return rows.map(toStackCheck);
  }

  async overdue(now: Date, most: number): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.phase, 'waiting'),
          lte(
            stackCheck.waitingSince,
            new Date(now.getTime() - WAITING_LIMIT_MS),
          ),
          or(
            isNull(stackCheck.leaseExpiresAt),
            lte(stackCheck.leaseExpiresAt, now),
          ),
        ),
      )
      .orderBy(asc(stackCheck.waitingSince))
      .limit(most);

    return rows.map(toStackCheck);
  }

  async withLapsedReservations(now: Date): Promise<readonly StackCheck[]> {
    const rows = await this.context.db
      .select()
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.phase, 'waiting'),
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
          eq(stackCheck.phase, 'waiting'),
          gt(
            stackCheck.waitingSince,
            new Date(now.getTime() - WAITING_LIMIT_MS),
          ),
        ),
      );

    return rows.map(toStackCheck).filter((each) => each.claimableAt(now));
  }

  async isClaimedBy(
    runId: string,
    runner: RunnerId,
    now: Date,
  ): Promise<boolean> {
    const [row] = await this.context.db
      .select({ stackId: stackCheck.stackId })
      .from(stackCheck)
      .where(
        and(
          eq(stackCheck.runId, runId),
          eq(stackCheck.claimedBy, runner.value),
          gt(stackCheck.leaseExpiresAt, now),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async removeForStacks(stackIds: readonly ChangeStackId[]): Promise<void> {
    if (stackIds.length === 0) {
      return;
    }

    await this.context.db.delete(stackCheck).where(
      inArray(
        stackCheck.stackId,
        stackIds.map((each) => each.value),
      ),
    );
  }
}
