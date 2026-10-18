import type { InferredOutputSchema } from '@integrations/domain/aggregates/inferred-output-schema.aggregate';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INFERRED_OUTPUT_SCHEMAS = Symbol('INFERRED_OUTPUT_SCHEMAS');

export interface InferredOutputSchemaRepository {
  of(teamId: TeamId, tool: ToolName): Promise<InferredOutputSchema | null>;

  ofTools(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly InferredOutputSchema[]>;

  save(schema: InferredOutputSchema): Promise<void>;

  deleteForIntegration(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<void>;

  deleteForTeam(teamId: TeamId): Promise<void>;
}
