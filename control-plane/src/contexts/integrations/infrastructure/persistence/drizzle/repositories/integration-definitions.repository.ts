import type {
  ListedServer,
  ListedServersPort,
} from '@integrations/application/ports/listed-servers.port';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyExistsError } from '@integrations/domain/exceptions/integration-already-exists.error';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { SpecFetchResult } from '@integrations/domain/value-objects/spec-fetch-result.vo';
import { integrationDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, lt, type SQL, sql } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const collided = (error: unknown): boolean =>
  (
    ((error as { cause?: unknown } | null)?.cause ?? error) as {
      code?: string;
    } | null
  )?.code === UNIQUE_VIOLATION;

type Row = typeof integrationDefinition.$inferSelect;

const readingOf = (row: Row): SpecFetchResult | null =>
  row.specFingerprint && row.specReadAt
    ? SpecFetchResult.rehydrate({
        fingerprint: row.specFingerprint,
        hash: row.specHash ? ContentHash.of(row.specHash) : null,
        readAt: row.specReadAt,
        problem: row.specProblem,
        skipped: row.specSkipped ?? [],
      })
    : null;

const readingColumns = (reading: SpecFetchResult | null) => ({
  specFingerprint: reading?.fingerprint ?? null,
  specHash: reading?.hash?.value ?? null,
  specReadAt: reading?.readAt ?? null,
  specProblem: reading?.problem ?? null,
  specSkipped: reading ? [...reading.skipped] : null,
});

const rehydrated = (row: Row): IntegrationDefinition =>
  IntegrationDefinition.rehydrate({
    id: IntegrationDefinitionId.of(row.id),
    teamId: TeamId.of(row.teamId),
    integration: IntegrationKey.of(row.integration),
    document: DefinitionDocument.of(row.definition),
    tools: row.tools,
    reading: readingOf(row),
    version: row.version,
  });

const inPlace = (definition: IntegrationDefinition) =>
  and(
    eq(integrationDefinition.id, definition.id.value),
    eq(integrationDefinition.version, definition.version),
  );

@Injectable()
export class DrizzleIntegrationDefinitions
  implements IntegrationDefinitionRepository, ListedServersPort
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  withId(id: IntegrationDefinitionId): Promise<IntegrationDefinition | null> {
    return this.first(eq(integrationDefinition.id, id.value));
  }

  of(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<IntegrationDefinition | null> {
    return this.first(
      and(
        eq(integrationDefinition.teamId, teamId.value),
        eq(integrationDefinition.integration, integration.value),
      ),
    );
  }

  async ofTeam(teamId: TeamId): Promise<readonly IntegrationDefinition[]> {
    return (
      await this.context.db
        .select()
        .from(integrationDefinition)
        .where(eq(integrationDefinition.teamId, teamId.value))
    ).map(rehydrated);
  }

  async claimListedBefore(
    before: Date,
    at: Date,
  ): Promise<readonly ListedServer[]> {
    const claimed = await this.context.db
      .update(integrationDefinition)
      .set({
        specReadAt: at,
        updatedAt: sql`${integrationDefinition.updatedAt}`,
      })
      .where(
        and(
          sql`${integrationDefinition.definition} ? 'mcp'`,
          lt(integrationDefinition.specReadAt, before),
        ),
      )
      .returning({
        teamId: integrationDefinition.teamId,
        integration: integrationDefinition.integration,
      });

    return claimed.map((each) => ({
      teamId: TeamId.of(each.teamId),
      integration: IntegrationKey.of(each.integration),
    }));
  }

  async save(definition: IntegrationDefinition): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(definition);
      await this.events.dispatch(definition.pullEvents());
    });
  }

  private async stored(definition: IntegrationDefinition): Promise<void> {
    const fields = {
      definition: { ...definition.document.fields },
      tools: [...definition.tools],
      ...readingColumns(definition.reading),
    };

    if (definition.isNew) {
      try {
        await this.context.db.insert(integrationDefinition).values({
          id: definition.id.value,
          teamId: definition.teamId.value,
          integration: definition.integration.value,
          ...fields,
        });
      } catch (error) {
        if (collided(error)) {
          throw new IntegrationAlreadyExistsError(definition.integration.value);
        }

        throw error;
      }

      return;
    }

    const touched = definition.isDeleted
      ? await this.context.db
          .delete(integrationDefinition)
          .where(inPlace(definition))
          .returning({ id: integrationDefinition.id })
      : await this.context.db
          .update(integrationDefinition)
          .set({ ...fields, version: definition.version + 1 })
          .where(inPlace(definition))
          .returning({ id: integrationDefinition.id });

    if (touched.length === 0) {
      throw new IntegrationDefinitionVersionConflictError(
        definition.integration.value,
      );
    }
  }

  private async first(
    where: SQL | undefined,
  ): Promise<IntegrationDefinition | null> {
    const [found] = await this.context.db
      .select()
      .from(integrationDefinition)
      .where(where)
      .limit(1);

    return found ? rehydrated(found) : null;
  }
}
