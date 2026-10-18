import { InferOutputSchemas } from '@integrations/application/services/infer-output-schemas.service';
import { InferredOutputSchema } from '@integrations/domain/aggregates/inferred-output-schema.aggregate';
import { InferredOutputSchemaVersionConflictError } from '@integrations/domain/exceptions/inferred-output-schema-version-conflict.error';
import type { InferredOutputSchemaRepository } from '@integrations/domain/repositories/inferred-output-schema.repository';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const keyOf = (teamId: TeamId, tool: ToolName): string =>
  `${teamId.value}:${tool.value}`;

export class InMemoryInferredOutputSchemas
  implements InferredOutputSchemaRepository
{
  readonly stored = new Map<string, InferredOutputSchema>();

  async of(
    teamId: TeamId,
    tool: ToolName,
  ): Promise<InferredOutputSchema | null> {
    return this.stored.get(keyOf(teamId, tool)) ?? null;
  }

  async ofTools(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly InferredOutputSchema[]> {
    return [...this.stored.values()].filter(
      (each) => each.teamId.equals(teamId) && tools.includes(each.tool.value),
    );
  }

  async save(schema: InferredOutputSchema): Promise<void> {
    const key = keyOf(schema.teamId, schema.tool);
    const current = this.stored.get(key);

    if ((current?.version ?? 0) !== schema.version) {
      throw new InferredOutputSchemaVersionConflictError(schema.tool.value);
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
  }

  async deleteForIntegration(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<void> {
    for (const [key, each] of this.stored) {
      if (each.teamId.equals(teamId) && each.integration.equals(integration)) {
        this.stored.delete(key);
      }
    }
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    for (const [key, each] of this.stored) {
      if (each.teamId.equals(teamId)) {
        this.stored.delete(key);
      }
    }
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
      sleep: async () => undefined,
    },
    QUIET,
  );
