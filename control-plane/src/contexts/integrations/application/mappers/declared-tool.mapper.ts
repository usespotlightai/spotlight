import type { DeclaredTool } from '@integrations/application/dto/declared-tool.dto';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';

export const DeclaredToolMapper = {
  of(provided: ProvidedTool, integrationName: string): DeclaredTool {
    return {
      tool: provided.tool.value,
      integrationName,
      description: provided.description,
      inputs: provided.inputs.map((each) => ({
        name: each.name,
        schema: each.schema.written,
        description: each.description,
        required: each.required,
        defaulted: each.defaulted,
        stdin: each.stdin,
      })),
      approval: provided.approval
        ? { because: provided.approval.because }
        : null,
      inferredOutput: null,
    };
  },
};
