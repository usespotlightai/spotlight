import {
  type DeliveryHeaders,
  InboundDelivery,
  type InboundDeliveryProgress,
} from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import { InboundDeliveryVersionConflictError } from '@integrations/domain/exceptions/inbound-delivery-version-conflict.error';
import type { InboundDeliveryRepository } from '@integrations/domain/repositories/inbound-delivery.repository';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { inboundDelivery } from '@integrations/infrastructure/persistence/drizzle/schemas/delivery.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lt, lte, or } from 'drizzle-orm';

type Row = typeof inboundDelivery.$inferSelect;

const progressOf = (row: Row): InboundDeliveryProgress => {
  if (row.state === 'pending') {
    return { kind: 'pending', dueAt: row.dueAt };
  }

  if (row.state === 'working') {
    if (!row.claimedAt) {
      throw new InconsistentStateError(
        'inbound delivery',
        `is worked on by no one (${row.id})`,
      );
    }

    return { kind: 'working', claimedAt: row.claimedAt };
  }

  if (!row.handledAt) {
    throw new InconsistentStateError(
      'inbound delivery',
      `finished at no time (${row.id})`,
    );
  }

  return { kind: row.state, at: row.handledAt };
};

const toDelivery = (row: Row): InboundDelivery =>
  InboundDelivery.rehydrate({
    integration: IntegrationKey.of(row.integration),
    to:
      row.workspaceId !== null && row.teamId !== null && row.teamKey !== null
        ? {
            workspaceId: WorkspaceId.of(row.workspaceId),
            teamId: TeamId.of(row.teamId),
            teamKey: row.teamKey,
          }
        : null,
    id: row.id,
    headers: row.headers as DeliveryHeaders,
    body: row.body,
    causeFiringId:
      row.causeFiringId === null ? null : HookFiringId.of(row.causeFiringId),
    receivedAt: row.receivedAt,
    progress: progressOf(row),
    attempts: row.attempts,
    failure: row.failed,
    version: row.version,
  });

const progressColumns = (progress: InboundDeliveryProgress) => {
  if (progress.kind === 'pending') {
    return {
      state: progress.kind,
      dueAt: progress.dueAt,
      claimedAt: null,
      handledAt: null,
    };
  }

  if (progress.kind === 'working') {
    return {
      state: progress.kind,
      claimedAt: progress.claimedAt,
      handledAt: null,
    };
  }

  return { state: progress.kind, handledAt: progress.at };
};

const columnsOf = (delivery: InboundDelivery) => ({
  attempts: delivery.attempts,
  failed: delivery.failure,
  ...progressColumns(delivery.progress),
});

@Injectable()
export class DrizzleInboundDeliveries implements InboundDeliveryRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(delivery: InboundDelivery): Promise<boolean> {
    const written = await this.context.db
      .insert(inboundDelivery)
      .values({
        integration: delivery.integration.value,
        workspaceId: delivery.to?.workspaceId.value ?? null,
        teamId: delivery.to?.teamId.value ?? null,
        teamKey: delivery.to?.teamKey ?? null,
        id: delivery.id,
        headers: delivery.headers,
        body: delivery.body ?? {},
        causeFiringId: delivery.causeFiringId?.value ?? null,
        receivedAt: delivery.receivedAt,
        dueAt: delivery.receivedAt,
        ...columnsOf(delivery),
      })
      .onConflictDoNothing()
      .returning({ id: inboundDelivery.id });

    return written.length > 0;
  }

  async claimNext(now: Date): Promise<InboundDelivery | null> {
    return this.context.inTransaction(async () => {
      const [row] = await this.context.db
        .select()
        .from(inboundDelivery)
        .where(
          or(
            and(
              eq(inboundDelivery.state, 'pending'),
              lte(inboundDelivery.dueAt, now),
            ),
            and(
              eq(inboundDelivery.state, 'working'),
              lt(
                inboundDelivery.claimedAt,
                InboundDelivery.leaseExpiredBefore(now),
              ),
            ),
          ),
        )
        .orderBy(asc(inboundDelivery.dueAt), asc(inboundDelivery.receivedAt))
        .limit(1)
        .for('update', { skipLocked: true });

      if (!row) {
        return null;
      }

      await this.save(toDelivery(row).claimed(now));

      return this.withSeq(row.seq);
    });
  }

  async save(delivery: InboundDelivery): Promise<void> {
    const written = await this.context.db
      .update(inboundDelivery)
      .set({ ...columnsOf(delivery), version: delivery.version + 1 })
      .where(
        and(
          eq(inboundDelivery.integration, delivery.integration.value),
          eq(inboundDelivery.id, delivery.id),
          delivery.to
            ? eq(inboundDelivery.teamId, delivery.to.teamId.value)
            : isNull(inboundDelivery.teamId),
          eq(inboundDelivery.version, delivery.version),
        ),
      )
      .returning({ id: inboundDelivery.id });

    if (written.length === 0) {
      throw new InboundDeliveryVersionConflictError(delivery.id);
    }
  }

  private async withSeq(seq: number): Promise<InboundDelivery | null> {
    const [row] = await this.context.db
      .select()
      .from(inboundDelivery)
      .where(eq(inboundDelivery.seq, seq))
      .limit(1);

    return row ? toDelivery(row) : null;
  }
}
