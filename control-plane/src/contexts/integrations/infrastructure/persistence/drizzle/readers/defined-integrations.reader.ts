import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
  TeamDefinedIntegrations,
} from '@integrations/application/ports/defined-integrations.port';
import { integrationDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { asc, eq } from 'drizzle-orm';

const DEFINED = {
  teamId: integrationDefinition.teamId,
  source: integrationDefinition.source,
  definition: integrationDefinition.definition,
};

@Injectable()
export class DrizzleDefinedIntegrations implements DefinedIntegrationsPort {
  constructor(private readonly context: DrizzleContext) {}

  async ofTeam(teamId: TeamId): Promise<readonly DefinedIntegration[]> {
    return this.context.db
      .select({
        source: integrationDefinition.source,
        definition: integrationDefinition.definition,
      })
      .from(integrationDefinition)
      .where(eq(integrationDefinition.teamId, teamId.value))
      .orderBy(asc(integrationDefinition.source));
  }

  async everywhere(): Promise<readonly TeamDefinedIntegrations[]> {
    const rows = await this.context.db
      .select(DEFINED)
      .from(integrationDefinition)
      .orderBy(
        asc(integrationDefinition.teamId),
        asc(integrationDefinition.source),
      );
    const teams = new Map<string, DefinedIntegration[]>();

    for (const { teamId, source, definition } of rows) {
      teams.set(teamId, [...(teams.get(teamId) ?? []), { source, definition }]);
    }

    return [...teams].map(([teamId, integrations]) => ({
      teamId: TeamId.of(teamId),
      integrations,
    }));
  }
}
