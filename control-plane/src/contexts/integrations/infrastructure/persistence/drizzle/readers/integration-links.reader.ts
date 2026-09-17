import type {
  IntegrationLink,
  IntegrationLinksPort,
} from '@configuration/application/ports/integration-links.port';
import { hostConnection } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleIntegrationLinksReader implements IntegrationLinksPort {
  constructor(private readonly context: DrizzleContext) {}

  async heldBy(teamId: TeamId): Promise<readonly IntegrationLink[]> {
    return this.context.db
      .select({ source: hostConnection.source, handle: hostConnection.handle })
      .from(hostConnection)
      .where(eq(hostConnection.teamId, teamId.value))
      .orderBy(asc(hostConnection.source));
  }
}
