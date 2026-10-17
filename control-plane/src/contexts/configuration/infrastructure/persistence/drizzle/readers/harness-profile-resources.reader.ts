import type {
  HarnessProfileRecord,
  HarnessProfileResourcesPort,
} from '@configuration/application/ports/harness-profile-resources.port';
import { harnessProfile } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

type ProfileRow = typeof harnessProfile.$inferSelect;

const recordFrom = (found: ProfileRow): HarnessProfileRecord => ({
  id: found.id,
  version: found.version,
  teamId: TeamId.of(found.teamId),
  definition: {
    key: found.key,
    permissions: found.permissions,
    mcpServers: found.mcpServers,
    native: found.native,
  },
});

@Injectable()
export class DrizzleHarnessProfileResources
  implements HarnessProfileResourcesPort
{
  constructor(private readonly context: DrizzleContext) {}

  withId(id: string): Promise<HarnessProfileRecord | null> {
    return this.stored(eq(harnessProfile.id, id));
  }

  at(teamId: TeamId, key: string): Promise<HarnessProfileRecord | null> {
    return this.stored(
      and(eq(harnessProfile.teamId, teamId.value), eq(harnessProfile.key, key)),
    );
  }

  async ofTeam(teamId: TeamId): Promise<readonly HarnessProfileRecord[]> {
    return (
      await this.context.db
        .select()
        .from(harnessProfile)
        .where(eq(harnessProfile.teamId, teamId.value))
    ).map(recordFrom);
  }

  private async stored(
    where: SQL | undefined,
  ): Promise<HarnessProfileRecord | null> {
    const [found] = await this.context.db
      .select()
      .from(harnessProfile)
      .where(where)
      .limit(1);

    return found ? recordFrom(found) : null;
  }
}
