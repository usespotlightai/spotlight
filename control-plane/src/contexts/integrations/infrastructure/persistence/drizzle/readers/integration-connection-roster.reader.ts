import type {
  IntegrationConnectionRosterPort,
  PersonConnection,
} from '@integrations/application/ports/integration-connection-roster.port';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { integrationConnection } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq, ne } from 'drizzle-orm';

@Injectable()
export class DrizzleIntegrationConnectionRoster
  implements IntegrationConnectionRosterPort
{
  constructor(private readonly context: DrizzleContext) {}

  async ofTeam(teamId: TeamId): Promise<readonly PersonConnection[]> {
    const rows = await this.context.db
      .select({
        integration: integrationConnection.integration,
        owner: integrationConnection.owner,
        linkedAccount: integrationConnection.linkedAccount,
        connectedAt: integrationConnection.connectedAt,
      })
      .from(integrationConnection)
      .where(
        and(
          eq(integrationConnection.teamId, teamId.value),
          ne(integrationConnection.owner, ConnectionOwner.team().key),
        ),
      )
      .orderBy(
        asc(integrationConnection.integration),
        asc(integrationConnection.connectedAt),
      );

    return rows.flatMap((row) => {
      const personId = ConnectionOwner.fromKey(row.owner).personId;

      return personId
        ? [
            {
              integration: row.integration,
              personId: personId.value,
              linkedAccount: row.linkedAccount,
              connectedAt: row.connectedAt,
            },
          ]
        : [];
    });
  }
}
