import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { integrationDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const collided = (error: unknown): boolean =>
  (
    ((error as { cause?: unknown } | null)?.cause ?? error) as {
      code?: string;
    } | null
  )?.code === UNIQUE_VIOLATION;

@Injectable()
export class DrizzleIntegrationDefinitions
  implements IntegrationDefinitionRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async of(
    teamId: TeamId,
    source: SourceKey,
  ): Promise<IntegrationDefinition | null> {
    const [found] = await this.context.db
      .select()
      .from(integrationDefinition)
      .where(
        and(
          eq(integrationDefinition.teamId, teamId.value),
          eq(integrationDefinition.source, source.value),
        ),
      )
      .limit(1);

    return found
      ? IntegrationDefinition.rehydrate({
          teamId: TeamId.of(found.teamId),
          source: SourceKey.of(found.source),
          document: DefinitionDocument.of(found.definition),
          version: found.version,
        })
      : null;
  }

  async save(definition: IntegrationDefinition): Promise<void> {
    const fields = { ...definition.document.fields };

    if (definition.isNew) {
      try {
        await this.context.db.insert(integrationDefinition).values({
          teamId: definition.teamId.value,
          source: definition.source.value,
          definition: fields,
        });
      } catch (error) {
        if (collided(error)) {
          throw new IntegrationDefinitionMovedOnError(definition.source.value);
        }

        throw error;
      }

      return;
    }

    const updated = await this.context.db
      .update(integrationDefinition)
      .set({ definition: fields, version: definition.version + 1 })
      .where(
        and(
          eq(integrationDefinition.teamId, definition.teamId.value),
          eq(integrationDefinition.source, definition.source.value),
          eq(integrationDefinition.version, definition.version),
        ),
      )
      .returning({ source: integrationDefinition.source });

    if (updated.length === 0) {
      throw new IntegrationDefinitionMovedOnError(definition.source.value);
    }
  }
}
