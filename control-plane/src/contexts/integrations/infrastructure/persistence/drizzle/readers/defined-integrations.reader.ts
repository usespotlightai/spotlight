import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
  TeamDefinedIntegrations,
} from '@integrations/application/ports/defined-integrations.port';
import type {
  IntegrationResourcesPort,
  KeptIntegration,
} from '@integrations/application/ports/integration-resources.port';
import { integrationDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq, type SQL } from 'drizzle-orm';

const DEFINED = {
  teamId: integrationDefinition.teamId,
  source: integrationDefinition.source,
  definition: integrationDefinition.definition,
};

const KEPT = {
  ...DEFINED,
  id: integrationDefinition.id,
  version: integrationDefinition.version,
};

@Injectable()
export class DrizzleDefinedIntegrations
  implements DefinedIntegrationsPort, IntegrationResourcesPort
{
  constructor(private readonly context: DrizzleContext) {}

  async ofTeam(teamId: TeamId): Promise<readonly KeptIntegration[]> {
    const found = await this.context.db
      .select(KEPT)
      .from(integrationDefinition)
      .where(eq(integrationDefinition.teamId, teamId.value))
      .orderBy(asc(integrationDefinition.source));

    return found.map((each) => ({ ...each, teamId }));
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

  withId(id: string): Promise<KeptIntegration | null> {
    return this.kept(eq(integrationDefinition.id, id));
  }

  at(teamId: TeamId, source: string): Promise<KeptIntegration | null> {
    return this.kept(
      and(
        eq(integrationDefinition.teamId, teamId.value),
        eq(integrationDefinition.source, source),
      ),
    );
  }

  private async kept(where: SQL | undefined): Promise<KeptIntegration | null> {
    const [found] = await this.context.db
      .select(KEPT)
      .from(integrationDefinition)
      .where(where)
      .limit(1);

    return found ? { ...found, teamId: TeamId.of(found.teamId) } : null;
  }
}
