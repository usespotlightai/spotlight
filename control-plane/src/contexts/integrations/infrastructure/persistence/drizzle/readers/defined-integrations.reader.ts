import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
  TeamDefinedIntegrations,
} from '@integrations/application/ports/defined-integrations.port';
import type {
  IntegrationRecord,
  IntegrationResourcesPort,
} from '@integrations/application/ports/integration-resources.port';
import { integrationDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq, type SQL } from 'drizzle-orm';

const DEFINED = {
  id: integrationDefinition.id,
  version: integrationDefinition.version,
  teamId: integrationDefinition.teamId,
  integration: integrationDefinition.integration,
  definition: integrationDefinition.definition,
  tools: integrationDefinition.tools,
  generatedFrom: integrationDefinition.specHash,
  readAt: integrationDefinition.specReadAt,
  problem: integrationDefinition.specProblem,
  skipped: integrationDefinition.specSkipped,
};

interface DefinedRow {
  readonly id: string;
  readonly version: number;
  readonly integration: string;
  readonly definition: Record<string, unknown>;
  readonly tools: string[];
  readonly generatedFrom: string | null;
  readonly readAt: Date | null;
  readonly problem: string | null;
  readonly skipped: string[] | null;
}

const definedOf = (row: DefinedRow): DefinedIntegration => ({
  id: row.id,
  version: row.version,
  integration: row.integration,
  definition: row.definition,
  tools: row.tools,
  generatedFrom: row.generatedFrom,
  reading: row.readAt
    ? {
        readAt: row.readAt,
        problem: row.problem,
        skipped: row.skipped ?? [],
      }
    : null,
});

const recordOf = (row: DefinedRow, teamId: TeamId): IntegrationRecord => ({
  ...definedOf(row),
  teamId,
});

@Injectable()
export class DrizzleDefinedIntegrations
  implements DefinedIntegrationsPort, IntegrationResourcesPort
{
  constructor(private readonly context: DrizzleContext) {}

  async ofTeam(teamId: TeamId): Promise<readonly IntegrationRecord[]> {
    const found = await this.context.db
      .select(DEFINED)
      .from(integrationDefinition)
      .where(eq(integrationDefinition.teamId, teamId.value))
      .orderBy(asc(integrationDefinition.integration));

    return found.map((each) => recordOf(each, teamId));
  }

  async everywhere(): Promise<readonly TeamDefinedIntegrations[]> {
    const rows = await this.context.db
      .select(DEFINED)
      .from(integrationDefinition)
      .orderBy(
        asc(integrationDefinition.teamId),
        asc(integrationDefinition.integration),
      );
    const teams = new Map<string, DefinedIntegration[]>();

    for (const { teamId, ...integration } of rows) {
      teams.set(teamId, [...(teams.get(teamId) ?? []), definedOf(integration)]);
    }

    return [...teams].map(([teamId, integrations]) => ({
      teamId: TeamId.of(teamId),
      integrations,
    }));
  }

  withId(id: string): Promise<IntegrationRecord | null> {
    return this.findOne(eq(integrationDefinition.id, id));
  }

  at(teamId: TeamId, integration: string): Promise<IntegrationRecord | null> {
    return this.findOne(
      and(
        eq(integrationDefinition.teamId, teamId.value),
        eq(integrationDefinition.integration, integration),
      ),
    );
  }

  private async findOne(
    where: SQL | undefined,
  ): Promise<IntegrationRecord | null> {
    const [found] = await this.context.db
      .select(DEFINED)
      .from(integrationDefinition)
      .where(where)
      .limit(1);

    return found ? recordOf(found, TeamId.of(found.teamId)) : null;
  }
}
