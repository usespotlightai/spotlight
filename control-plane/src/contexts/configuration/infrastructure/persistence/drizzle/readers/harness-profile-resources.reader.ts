import type {
  HarnessProfileResourcesPort,
  KeptProfile,
} from '@configuration/application/ports/harness-profile-resources.port';
import { harnessProfile } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

@Injectable()
export class DrizzleHarnessProfileResources
  implements HarnessProfileResourcesPort
{
  constructor(private readonly context: DrizzleContext) {}

  withId(id: string): Promise<KeptProfile | null> {
    return this.kept(eq(harnessProfile.id, id));
  }

  at(teamId: TeamId, key: string): Promise<KeptProfile | null> {
    return this.kept(
      and(eq(harnessProfile.teamId, teamId.value), eq(harnessProfile.key, key)),
    );
  }

  private async kept(where: SQL | undefined): Promise<KeptProfile | null> {
    const [found] = await this.context.db
      .select()
      .from(harnessProfile)
      .where(where)
      .limit(1);

    return found
      ? {
          id: found.id,
          version: found.version,
          teamId: TeamId.of(found.teamId),
          definition: {
            key: found.key,
            permissions: found.permissions,
            mcpServers: found.mcpServers,
            native: found.native,
          },
        }
      : null;
  }
}
