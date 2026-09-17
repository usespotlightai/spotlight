import type {
  DeliveryInboxPort,
  StoredDelivery,
} from '@integrations/application/ports/delivery-inbox.port';
import type { WebhookHeaders } from '@integrations/application/ports/webhook-source.port';
import { inboundDelivery } from '@integrations/infrastructure/persistence/drizzle/schemas/delivery.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { and, asc, eq, lt, lte, or, sql } from 'drizzle-orm';

const REASON_LIMIT = 1_000;

const LEASE_MS = 10 * 60 * 1000;

@Injectable()
export class DrizzleDeliveryInbox implements DeliveryInboxPort {
  constructor(private readonly context: DrizzleContext) {}

  async accept(delivered: StoredDelivery): Promise<boolean> {
    const written = await this.context.db
      .insert(inboundDelivery)
      .values({
        source: delivered.source,
        workspaceId: delivered.workspaceId,
        teamId: delivered.teamId,
        teamKey: delivered.teamKey,
        id: delivered.id,
        headers: delivered.headers,
        body: delivered.body ?? {},
      })
      .onConflictDoNothing()
      .returning({ id: inboundDelivery.id });

    return written.length > 0;
  }

  async claimNext(now: Date): Promise<StoredDelivery | null> {
    const found = await this.context.run(async () => {
      const lapsed = new Date(now.getTime() - LEASE_MS);
      const [waiting] = await this.context.db
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
              lt(inboundDelivery.claimedAt, lapsed),
            ),
          ),
        )
        .orderBy(asc(inboundDelivery.dueAt), asc(inboundDelivery.receivedAt))
        .limit(1)
        .for('update', { skipLocked: true });

      if (waiting) {
        await this.context.db
          .update(inboundDelivery)
          .set({ state: 'working', claimedAt: now })
          .where(this.theOne(waiting));
      }

      return waiting ?? null;
    });

    if (!found) {
      return null;
    }

    return {
      source: found.source,
      workspaceId: found.workspaceId,
      teamId: found.teamId,
      teamKey: found.teamKey,
      id: found.id,
      headers: (found.headers ?? {}) as WebhookHeaders,
      body: found.body,
      attempts: found.attempts,
    };
  }

  async worked(delivered: StoredDelivery, at: Date): Promise<void> {
    await this.context.db
      .update(inboundDelivery)
      .set({
        state: 'done',
        handledAt: at,
        attempts: sql`${inboundDelivery.attempts} + 1`,
      })
      .where(this.theOne(delivered));
  }

  async retryAt(
    delivered: StoredDelivery,
    because: string,
    at: Date,
  ): Promise<void> {
    await this.context.db
      .update(inboundDelivery)
      .set({
        state: 'pending',
        dueAt: at,
        claimedAt: null,
        attempts: sql`${inboundDelivery.attempts} + 1`,
        failed: because.slice(0, REASON_LIMIT),
      })
      .where(this.theOne(delivered));
  }

  async failed(
    delivered: StoredDelivery,
    because: string,
    at: Date,
  ): Promise<void> {
    await this.context.db
      .update(inboundDelivery)
      .set({
        state: 'failed',
        handledAt: at,
        attempts: sql`${inboundDelivery.attempts} + 1`,
        failed: because.slice(0, REASON_LIMIT),
      })
      .where(this.theOne(delivered));
  }

  private theOne(delivered: {
    readonly source: string;
    readonly teamId: string;
    readonly id: string;
  }) {
    return and(
      eq(inboundDelivery.source, delivered.source),
      eq(inboundDelivery.teamId, delivered.teamId),
      eq(inboundDelivery.id, delivered.id),
    );
  }
}
