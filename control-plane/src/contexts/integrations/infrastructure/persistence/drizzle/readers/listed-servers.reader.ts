import type {
  ListedServer,
  ListedServersPort,
} from '@integrations/application/ports/listed-servers.port';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { integrationDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, lt } from 'drizzle-orm';

@Injectable()
export class DrizzleListedServers implements ListedServersPort {
  constructor(private readonly context: DrizzleContext) {}

  async listedBefore(before: Date): Promise<readonly ListedServer[]> {
    const rows = await this.context.db
      .select({
        teamId: integrationDefinition.teamId,
        integration: integrationDefinition.integration,
      })
      .from(integrationDefinition)
      .where(
        and(
          eq(integrationDefinition.relistsTools, true),
          lt(integrationDefinition.specReadAt, before),
        ),
      );

    return rows.map((each) => ({
      teamId: TeamId.of(each.teamId),
      integration: IntegrationKey.of(each.integration),
    }));
  }
}
