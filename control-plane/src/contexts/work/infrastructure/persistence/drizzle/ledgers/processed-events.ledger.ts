import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';
import { processedEvent } from '@work/infrastructure/persistence/drizzle/schemas/processed-event.schema';
import { and, eq, lt, sql } from 'drizzle-orm';

const hashed = (key: string): string =>
  createHash('sha256').update(key).digest('hex');

@Injectable()
export class DrizzleProcessedEvents implements ProcessedEventsPort {
  constructor(private readonly context: DrizzleContext) {}

  async wasProcessed(workspaceId: WorkspaceId, key: string): Promise<boolean> {
    const [found] = await this.context.db
      .select({ key: processedEvent.key })
      .from(processedEvent)
      .where(
        and(
          eq(processedEvent.workspaceId, workspaceId.value),
          eq(processedEvent.key, hashed(key)),
        ),
      );

    return found !== undefined;
  }

  async markProcessed(
    workspaceId: WorkspaceId,
    key: string,
    at: Date,
  ): Promise<boolean> {
    const first = await this.context.db
      .insert(processedEvent)
      .values({
        workspaceId: workspaceId.value,
        key: hashed(key),
        processedAt: at,
      })
      .onConflictDoNothing()
      .returning({ key: processedEvent.key });

    return first.length > 0;
  }

  async purgeBefore(before: Date, max: number): Promise<number> {
    const doomed = this.context.db
      .select({
        workspaceId: processedEvent.workspaceId,
        key: processedEvent.key,
      })
      .from(processedEvent)
      .where(lt(processedEvent.processedAt, before))
      .limit(max);
    const purged = await this.context.db
      .delete(processedEvent)
      .where(
        sql`(${processedEvent.workspaceId}, ${processedEvent.key}) in ${doomed}`,
      )
      .returning({ key: processedEvent.key });

    return purged.length;
  }
}
