import type { ToolOutputShapesPort } from '@integrations/application/ports/tool-output-shapes.port';
import { InferOutputSchemas } from '@integrations/application/services/infer-output-schemas.service';
import { InferredOutputSchema } from '@integrations/domain/aggregates/inferred-output-schema.aggregate';
import { InferredOutputSchemaVersionConflictError } from '@integrations/domain/exceptions/inferred-output-schema-version-conflict.error';
import type { InferredOutputSchemaRepository } from '@integrations/domain/repositories/inferred-output-schema.repository';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { JsonObject } from '@shared-kernel/domain/json-value';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const keyOf = (teamId: TeamId, tool: ToolName): string =>
  `${teamId.value}:${tool.value}`;

export class InMemoryInferredOutputSchemas
  implements InferredOutputSchemaRepository, ToolOutputShapesPort
{
  readonly stored = new Map<string, InferredOutputSchema>();

  of(teamId: TeamId, tool: ToolName): Promise<InferredOutputSchema | null> {
    return Promise.resolve(this.stored.get(keyOf(teamId, tool)) ?? null);
  }

  ofTools(
    teamId: TeamId,
    tools: readonly ToolName[],
  ): Promise<ReadonlyMap<string, JsonObject>> {
    return Promise.resolve(
      new Map(
        [...this.stored.values()]
          .filter(
            (each) =>
              each.teamId.equals(teamId) &&
              tools.some((tool) => tool.equals(each.tool)),
          )
          .map((each) => [each.tool.value, each.shape.schema]),
      ),
    );
  }

  save(schema: InferredOutputSchema): Promise<void> {
    const key = keyOf(schema.teamId, schema.tool);
    const current = this.stored.get(key);

    if ((current?.version ?? 0) !== schema.version) {
      return Promise.reject(
        new InferredOutputSchemaVersionConflictError(schema.tool.value),
      );
    }

    this.stored.set(
      key,
      InferredOutputSchema.rehydrate({
        teamId: schema.teamId,
        tool: schema.tool,
        shape: schema.shape,
        calls: schema.calls,
        inferredAt: schema.inferredAt,
        version: schema.version + 1,
      }),
    );

    return Promise.resolve();
  }

  ofIntegration(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<readonly InferredOutputSchema[]> {
    return Promise.resolve(
      [...this.stored.values()].filter(
        (each) =>
          each.teamId.equals(teamId) && each.integration.equals(integration),
      ),
    );
  }

  ofTeam(teamId: TeamId): Promise<readonly InferredOutputSchema[]> {
    return Promise.resolve(
      [...this.stored.values()].filter((each) => each.teamId.equals(teamId)),
    );
  }

  remove(schema: InferredOutputSchema): Promise<void> {
    const key = keyOf(schema.teamId, schema.tool);

    if (this.stored.get(key)?.version !== schema.version) {
      return Promise.reject(
        new InferredOutputSchemaVersionConflictError(schema.tool.value),
      );
    }

    this.stored.delete(key);

    return Promise.resolve();
  }
}

const QUIET = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export const inferringInto = (
  schemas: InferredOutputSchemaRepository = new InMemoryInferredOutputSchemas(),
): InferOutputSchemas =>
  new InferOutputSchemas(
    schemas,
    {
      now: () => new Date('2026-10-05T12:00:00.000Z'),
      sleep: () => Promise.resolve(undefined),
    },
    QUIET,
  );
