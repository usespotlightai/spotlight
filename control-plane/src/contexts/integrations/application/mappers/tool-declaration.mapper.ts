import type { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export const ToolDeclarationMapper = {
  toDeclaration(
    offered: OfferedTool,
    integrationName: string,
  ): ToolDeclaration {
    return {
      tool: offered.tool,
      integrationName,
      description: offered.description,
      inputs: offered.inputs.map((each) => ({
        name: each.name,
        schema: each.schema.written,
        description: each.description,
        required: each.required,
        defaulted: each.defaulted,
        piped: each.piped,
      })),
      approval: offered.approval ? { because: offered.approval.because } : null,
      learnedOutput: null,
    };
  },
};
