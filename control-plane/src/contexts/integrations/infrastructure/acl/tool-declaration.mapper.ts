import type { DeclaredTool } from '@integrations/application/dto/declared-tool.dto';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export const ToolDeclarationMapper = {
  toDeclaration(declared: DeclaredTool): ToolDeclaration {
    return {
      tool: declared.tool,
      integrationName: declared.integrationName,
      description: declared.description,
      inputs: declared.inputs.map((each) => ({ ...each })),
      approval: declared.approval
        ? { because: declared.approval.because }
        : null,
      inferredOutput: declared.inferredOutput,
    };
  },
};
