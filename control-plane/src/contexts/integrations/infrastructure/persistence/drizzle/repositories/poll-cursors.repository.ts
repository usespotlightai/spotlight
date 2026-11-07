import { PollCursor } from '@integrations/domain/aggregates/poll-cursor.aggregate';
import { PollCursorVersionConflictError } from '@integrations/domain/exceptions/poll-cursor-version-conflict.error';
import type { PollCursorRepository } from '@integrations/domain/repositories/poll-cursor.repository';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { pollCursor } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzlePollCursors implements PollCursorRepository {
  constructor(private readonly context: DrizzleContext) {}

  async of(teamId: TeamId, integration: IntegrationKey): Promise<PollCursor> {
    const [found] = await this.context.db
      .select()
      .from(pollCursor)
      .where(
        and(
          eq(pollCursor.teamId, teamId.value),
          eq(pollCursor.integration, integration.value),
        ),
      )
      .limit(1);

    return found
      ? PollCursor.rehydrate({
          teamId,
          integration,
          cursor: found.cursor,
          polledAt: found.polledAt,
          version: found.version,
        })
      : PollCursor.start(teamId, integration);
  }

  async ofTeam(teamId: TeamId): Promise<readonly PollCursor[]> {
    const rows = await this.context.db
      .select()
      .from(pollCursor)
      .where(eq(pollCursor.teamId, teamId.value));

    return rows.map((row) =>
      PollCursor.rehydrate({
        teamId: TeamId.of(row.teamId),
        integration: IntegrationKey.of(row.integration),
        cursor: row.cursor,
        polledAt: row.polledAt,
        version: row.version,
      }),
    );
  }

  async remove(cursor: PollCursor): Promise<void> {
    const removed = await this.context.db
      .delete(pollCursor)
      .where(
        and(
          eq(pollCursor.teamId, cursor.teamId.value),
          eq(pollCursor.integration, cursor.integration.value),
          eq(pollCursor.version, cursor.version),
        ),
      )
      .returning({ integration: pollCursor.integration });

    if (removed.length === 0) {
      throw new PollCursorVersionConflictError(cursor.integration.value);
    }
  }

  async save(cursor: PollCursor): Promise<void> {
    const written = { cursor: cursor.cursor, polledAt: cursor.polledAt };
    const saved = cursor.isNew
      ? await this.context.db
          .insert(pollCursor)
          .values({
            teamId: cursor.teamId.value,
            integration: cursor.integration.value,
            ...written,
          })
          .onConflictDoNothing()
          .returning({ integration: pollCursor.integration })
      : await this.context.db
          .update(pollCursor)
          .set({ ...written, version: cursor.version + 1 })
          .where(
            and(
              eq(pollCursor.teamId, cursor.teamId.value),
              eq(pollCursor.integration, cursor.integration.value),
              eq(pollCursor.version, cursor.version),
            ),
          )
          .returning({ integration: pollCursor.integration });

    if (saved.length === 0) {
      throw new PollCursorVersionConflictError(cursor.integration.value);
    }
  }
}
