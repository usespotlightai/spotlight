import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyDefinedError } from '@integrations/domain/exceptions/integration-already-defined.error';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { integrationDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const collided = (error: unknown): boolean =>
  (
    ((error as { cause?: unknown } | null)?.cause ?? error) as {
      code?: string;
    } | null
  )?.code === UNIQUE_VIOLATION;

const inPlace = (definition: IntegrationDefinition) =>
  and(
    eq(integrationDefinition.id, definition.id.value),
    eq(integrationDefinition.version, definition.version),
  );

@Injectable()
export class DrizzleIntegrationDefinitions
  implements IntegrationDefinitionRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  withId(id: IntegrationDefinitionId): Promise<IntegrationDefinition | null> {
    return this.first(eq(integrationDefinition.id, id.value));
  }

  of(teamId: TeamId, source: SourceKey): Promise<IntegrationDefinition | null> {
    return this.first(
      and(
        eq(integrationDefinition.teamId, teamId.value),
        eq(integrationDefinition.source, source.value),
      ),
    );
  }

  async save(definition: IntegrationDefinition): Promise<void> {
    await this.context.run(async () => {
      await this.stored(definition);
      await this.events.dispatch(definition.pullEvents());
    });
  }

  private async stored(definition: IntegrationDefinition): Promise<void> {
    const fields = {
      definition: { ...definition.document.fields },
      offers: [...definition.offers],
    };

    if (definition.isNew) {
      try {
        await this.context.db.insert(integrationDefinition).values({
          id: definition.id.value,
          teamId: definition.teamId.value,
          source: definition.source.value,
          ...fields,
        });
      } catch (error) {
        if (collided(error)) {
          throw new IntegrationAlreadyDefinedError(definition.source.value);
        }

        throw error;
      }

      return;
    }

    const touched = definition.isRetired
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
      throw new IntegrationDefinitionMovedOnError(definition.source.value);
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

    return found
      ? IntegrationDefinition.rehydrate({
          id: IntegrationDefinitionId.of(found.id),
          teamId: TeamId.of(found.teamId),
          source: SourceKey.of(found.source),
          document: DefinitionDocument.of(found.definition),
          offers: found.offers,
          version: found.version,
        })
      : null;
  }
}
