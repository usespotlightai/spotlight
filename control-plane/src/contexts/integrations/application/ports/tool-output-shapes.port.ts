import type { JsonObject } from '@shared-kernel/domain/json-value';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TOOL_OUTPUT_SHAPES = Symbol('TOOL_OUTPUT_SHAPES');

export interface ToolOutputShapesPort {
  ofTools(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<ReadonlyMap<string, JsonObject>>;
}
