import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export const ToolDeclarationMapper = {
  toDeclaration(
    provided: ProvidedTool,
    integrationName: string,
  ): ToolDeclaration {
    return {
      tool: provided.tool,
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
