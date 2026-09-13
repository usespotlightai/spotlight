import type {
  DeliveryInboxPort,
  StoredDelivery,
} from '@application/ports/delivery-inbox.port';
import type { WebhookHeaders } from '@application/ports/webhook-source.port';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { inboundDelivery } from '@infrastructure/persistence/drizzle/schemas/delivery.schema';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

const REASON_LIMIT = 1_000;

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

  async nextPending(): Promise<StoredDelivery | null> {
    const [found] = await this.context.db
      .select()
      .from(inboundDelivery)
      .where(eq(inboundDelivery.state, 'pending'))
      .orderBy(asc(inboundDelivery.receivedAt))
      .limit(1)
      .for('update', { skipLocked: true });

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

  async worked(delivered: StoredDelivery): Promise<void> {
    await this.context.db
      .update(inboundDelivery)
      .set({
        state: 'done',
        handledAt: new Date(),
        attempts: sql`${inboundDelivery.attempts} + 1`,
      })
      .where(this.theOne(delivered));
  }

  async failed(delivered: StoredDelivery, because: string): Promise<void> {
    await this.context.db
      .update(inboundDelivery)
      .set({
        state: 'failed',
        handledAt: new Date(),
        attempts: sql`${inboundDelivery.attempts} + 1`,
        failed: because.slice(0, REASON_LIMIT),
      })
      .where(this.theOne(delivered));
  }

  private theOne(delivered: StoredDelivery) {
    return and(
      eq(inboundDelivery.source, delivered.source),
      eq(inboundDelivery.teamId, delivered.teamId),
      eq(inboundDelivery.id, delivered.id),
    );
  }
}
