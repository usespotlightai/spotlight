import type {
  IntegrationCursorsPort,
  PollState,
} from '@integrations/application/ports/integration-cursors.port';
import { integrationCursor } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, isNull } from 'drizzle-orm';

@Injectable()
export class DrizzleIntegrationCursors implements IntegrationCursorsPort {
  constructor(private readonly context: DrizzleContext) {}

  async read(teamId: TeamId, source: string): Promise<PollState> {
    const [found] = await this.context.db
      .select()
      .from(integrationCursor)
      .where(this.theOne(teamId, source))
      .limit(1);

    return { cursor: found?.cursor ?? null, ranAt: found?.ranAt ?? null };
  }

  async claimTurn(
    teamId: TeamId,
    source: string,
    seen: PollState,
    at: Date,
  ): Promise<boolean> {
    const claimed = await this.context.db
      .insert(integrationCursor)
      .values({
        teamId: teamId.value,
        source,
        cursor: seen.cursor,
        ranAt: at,
      })
      .onConflictDoUpdate({
        target: [integrationCursor.teamId, integrationCursor.source],
        set: { ranAt: at },
        setWhere: seen.ranAt
          ? eq(integrationCursor.ranAt, seen.ranAt)
          : isNull(integrationCursor.ranAt),
      })
      .returning({ source: integrationCursor.source });

    return claimed.length > 0;
  }

  async advance(
    teamId: TeamId,
    source: string,
    cursor: string | null,
    claimedAt: Date,
  ): Promise<boolean> {
    const advanced = await this.context.db
      .update(integrationCursor)
      .set({ cursor })
      .where(
        and(
          this.theOne(teamId, source),
          eq(integrationCursor.ranAt, claimedAt),
        ),
      )
      .returning({ source: integrationCursor.source });

    return advanced.length > 0;
  }

  private theOne(teamId: TeamId, source: string) {
    return and(
      eq(integrationCursor.teamId, teamId.value),
      eq(integrationCursor.source, source),
    );
  }
}
