import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TeamWelcomesPort } from '@work/application/ports/team-welcomes.port';
import { teamWelcome } from '@work/infrastructure/persistence/drizzle/schemas/team-welcome.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleTeamWelcomes implements TeamWelcomesPort {
  constructor(private readonly context: DrizzleContext) {}

  async welcomed(teamId: TeamId): Promise<boolean> {
    const [found] = await this.context.db
      .select({ teamId: teamWelcome.teamId })
      .from(teamWelcome)
      .where(eq(teamWelcome.teamId, teamId.value));

    return found !== undefined;
  }

  async record(teamId: TeamId): Promise<void> {
    await this.context.db.insert(teamWelcome).values({ teamId: teamId.value });
  }

  async forget(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(teamWelcome)
      .where(eq(teamWelcome.teamId, teamId.value));
  }
}
