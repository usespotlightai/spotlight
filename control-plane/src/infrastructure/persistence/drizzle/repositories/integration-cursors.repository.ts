import type {
  IntegrationCursorsPort,
  PollState,
} from '@application/ports/integration-cursors.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { integrationCursor } from '@infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleIntegrationCursors implements IntegrationCursorsPort {
  constructor(private readonly context: DrizzleContext) {}

  async read(teamId: TeamId, source: string): Promise<PollState> {
    const [found] = await this.context.db
      .select()
      .from(integrationCursor)
      .where(
        and(
          eq(integrationCursor.teamId, teamId.value),
          eq(integrationCursor.source, source),
        ),
      )
      .limit(1);

    return { cursor: found?.cursor ?? null, ranAt: found?.ranAt ?? null };
  }

  async saved(
    teamId: TeamId,
    source: string,
    cursor: string | null,
    ranAt: Date,
  ): Promise<void> {
    await this.context.db
      .insert(integrationCursor)
      .values({ teamId: teamId.value, source, cursor, ranAt })
      .onConflictDoUpdate({
        target: [integrationCursor.teamId, integrationCursor.source],
        set: { cursor, ranAt },
      });
  }
}
