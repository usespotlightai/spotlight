import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  ProjectedTeam,
  WorkTeamsPort,
} from '@work/application/ports/work-teams.port';
import { workTeam } from '@work/infrastructure/persistence/drizzle/schemas/work-station.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkTeams implements WorkTeamsPort {
  constructor(private readonly context: DrizzleContext) {}

  async project(team: ProjectedTeam): Promise<void> {
    await this.context.db
      .insert(workTeam)
      .values({ teamId: team.teamId.value, key: team.key })
      .onConflictDoNothing();
  }

  async forget(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(workTeam)
      .where(eq(workTeam.teamId, teamId.value));
  }
}
