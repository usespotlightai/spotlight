import type {
  ConnectedIntegration,
  ConnectedIntegrationsPort,
} from '@integrations/application/ports/connected-integrations.port';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { integrationConnection } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleConnectedIntegrations implements ConnectedIntegrationsPort {
  constructor(private readonly context: DrizzleContext) {}

  async ofTeam(teamId: TeamId): Promise<readonly ConnectedIntegration[]> {
    return this.context.db
      .select({
        integration: integrationConnection.integration,
        linkedAccount: integrationConnection.linkedAccount,
      })
      .from(integrationConnection)
      .where(
        and(
          eq(integrationConnection.teamId, teamId.value),
          eq(integrationConnection.owner, ConnectionOwner.team().key),
        ),
      )
      .orderBy(asc(integrationConnection.integration));
  }
}
