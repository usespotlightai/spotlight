import { ScheduleCursor } from '@integrations/domain/aggregates/schedule-cursor.aggregate';
import { ScheduleCursorVersionConflictError } from '@integrations/domain/exceptions/schedule-cursor-version-conflict.error';
import type { ScheduleCursorRepository } from '@integrations/domain/repositories/schedule-cursor.repository';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { scheduleCursor } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleScheduleCursors implements ScheduleCursorRepository {
  constructor(private readonly context: DrizzleContext) {}

  async of(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<ScheduleCursor> {
    const [found] = await this.context.db
      .select()
      .from(scheduleCursor)
      .where(
        and(
          eq(scheduleCursor.teamId, teamId.value),
          eq(scheduleCursor.integration, integration.value),
        ),
      )
      .limit(1);

    return found
      ? ScheduleCursor.rehydrate({
          teamId,
          integration,
          ranAt: found.ranAt,
          version: found.version,
        })
      : ScheduleCursor.start(teamId, integration);
  }

  async ofTeam(teamId: TeamId): Promise<readonly ScheduleCursor[]> {
    const rows = await this.context.db
      .select()
      .from(scheduleCursor)
      .where(eq(scheduleCursor.teamId, teamId.value));

    return rows.map((row) =>
      ScheduleCursor.rehydrate({
        teamId: TeamId.of(row.teamId),
        integration: IntegrationKey.rehydrate(row.integration),
        ranAt: row.ranAt,
        version: row.version,
      }),
    );
  }

  async remove(cursor: ScheduleCursor): Promise<void> {
    const removed = await this.context.db
      .delete(scheduleCursor)
      .where(
        and(
          eq(scheduleCursor.teamId, cursor.teamId.value),
          eq(scheduleCursor.integration, cursor.integration.value),
          eq(scheduleCursor.version, cursor.version),
        ),
      )
      .returning({ integration: scheduleCursor.integration });

    if (removed.length === 0) {
      throw new ScheduleCursorVersionConflictError(cursor.integration.value);
    }
  }

  async save(cursor: ScheduleCursor): Promise<void> {
    const ranAt = cursor.ranAt;

    if (ranAt === null) {
      throw new InconsistentStateError(
        'schedule cursor',
        'is stored only once it ran',
      );
    }

    const saved = cursor.isNew
      ? await this.context.db
          .insert(scheduleCursor)
          .values({
            teamId: cursor.teamId.value,
            integration: cursor.integration.value,
            ranAt,
          })
          .onConflictDoNothing()
          .returning({ integration: scheduleCursor.integration })
      : await this.context.db
          .update(scheduleCursor)
          .set({ ranAt, version: cursor.version + 1 })
          .where(
            and(
              eq(scheduleCursor.teamId, cursor.teamId.value),
              eq(scheduleCursor.integration, cursor.integration.value),
              eq(scheduleCursor.version, cursor.version),
            ),
          )
          .returning({ integration: scheduleCursor.integration });

    if (saved.length === 0) {
      throw new ScheduleCursorVersionConflictError(cursor.integration.value);
    }
  }
}
