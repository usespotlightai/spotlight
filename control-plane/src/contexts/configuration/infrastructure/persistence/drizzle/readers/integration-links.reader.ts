import type {
  IntegrationLink,
  IntegrationLinksPort,
} from '@configuration/application/ports/integration-links.port';
import { integrationLink } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleIntegrationLinks implements IntegrationLinksPort {
  constructor(private readonly context: DrizzleContext) {}

  async heldBy(teamId: TeamId): Promise<readonly IntegrationLink[]> {
    return this.context.db
      .select({
        source: integrationLink.source,
        handle: integrationLink.handle,
      })
      .from(integrationLink)
      .where(eq(integrationLink.teamId, teamId.value))
      .orderBy(asc(integrationLink.source));
  }

  async linked(teamId: TeamId, link: IntegrationLink): Promise<void> {
    await this.context.db
      .insert(integrationLink)
      .values({
        teamId: teamId.value,
        source: link.source,
        handle: link.handle,
      })
      .onConflictDoUpdate({
        target: [integrationLink.teamId, integrationLink.source],
        set: { handle: link.handle },
      });
  }
}
