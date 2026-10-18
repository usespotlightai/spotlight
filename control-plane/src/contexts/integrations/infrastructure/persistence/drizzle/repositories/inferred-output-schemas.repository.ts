import { InferredOutputSchema } from '@integrations/domain/aggregates/inferred-output-schema.aggregate';
import { InferredOutputSchemaVersionConflictError } from '@integrations/domain/exceptions/inferred-output-schema-version-conflict.error';
import type { InferredOutputSchemaRepository } from '@integrations/domain/repositories/inferred-output-schema.repository';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { inferredOutputSchema } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, inArray } from 'drizzle-orm';

type Row = typeof inferredOutputSchema.$inferSelect;

const rehydrate = (row: Row): InferredOutputSchema =>
  InferredOutputSchema.rehydrate({
    teamId: TeamId.of(row.teamId),
    tool: ToolName.of(row.tool),
    shape: OutputShape.fromStored(row.shape),
    calls: row.calls,
    inferredAt: row.inferredAt,
    version: row.version,
  });

export class DrizzleInferredOutputSchemas
  implements InferredOutputSchemaRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async of(
    teamId: TeamId,
    tool: ToolName,
  ): Promise<InferredOutputSchema | null> {
    const [found] = await this.context.db
      .select()
      .from(inferredOutputSchema)
      .where(
        and(
          eq(inferredOutputSchema.teamId, teamId.value),
          eq(inferredOutputSchema.tool, tool.value),
        ),
      )
      .limit(1);

    return found ? rehydrate(found) : null;
  }

  async ofTools(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly InferredOutputSchema[]> {
    if (tools.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(inferredOutputSchema)
      .where(
        and(
          eq(inferredOutputSchema.teamId, teamId.value),
          inArray(inferredOutputSchema.tool, [...tools]),
        ),
      );

    return rows.map(rehydrate);
  }

  async save(schema: InferredOutputSchema): Promise<void> {
    const written = {
      shape: schema.shape.toJson(),
      calls: schema.calls,
      inferredAt: schema.inferredAt,
    };

    const saved = schema.isNew
      ? await this.context.db
          .insert(inferredOutputSchema)
          .values({
            teamId: schema.teamId.value,
            tool: schema.tool.value,
            integration: schema.integration.value,
            ...written,
          })
          .onConflictDoNothing()
          .returning({ tool: inferredOutputSchema.tool })
      : await this.context.db
          .update(inferredOutputSchema)
          .set({ ...written, version: schema.version + 1 })
          .where(
            and(
              eq(inferredOutputSchema.teamId, schema.teamId.value),
              eq(inferredOutputSchema.tool, schema.tool.value),
              eq(inferredOutputSchema.version, schema.version),
            ),
          )
          .returning({ tool: inferredOutputSchema.tool });

    if (saved.length === 0) {
      throw new InferredOutputSchemaVersionConflictError(schema.tool.value);
    }
  }

  async deleteForIntegration(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<void> {
    await this.context.db
      .delete(inferredOutputSchema)
      .where(
        and(
          eq(inferredOutputSchema.teamId, teamId.value),
          eq(inferredOutputSchema.integration, integration.value),
        ),
      );
  }

  async deleteForTeam(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(inferredOutputSchema)
      .where(eq(inferredOutputSchema.teamId, teamId.value));
  }
}
