import type { ToolOutputShapesPort } from '@integrations/application/ports/tool-output-shapes.port';
import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { inferredOutputSchema } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { JsonObject } from '@shared-kernel/domain/json-value';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleToolOutputShapes implements ToolOutputShapesPort {
  constructor(private readonly context: DrizzleContext) {}

  async ofTools(
    teamId: TeamId,
    tools: readonly ToolName[],
  ): Promise<ReadonlyMap<string, JsonObject>> {
    if (tools.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({
        tool: inferredOutputSchema.tool,
        shape: inferredOutputSchema.shape,
      })
      .from(inferredOutputSchema)
      .where(
        and(
          eq(inferredOutputSchema.teamId, teamId.value),
          inArray(
            inferredOutputSchema.tool,
            tools.map((each) => each.value),
          ),
        ),
      );

    return new Map(
      rows.map((row) => [row.tool, OutputShape.fromStored(row.shape).schema]),
    );
  }
}
