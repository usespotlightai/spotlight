import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';

export const ToolDeclarationMapper = {
  toDeclared(declaration: ToolDeclaration): DeclaredTool {
    return DeclaredTool.of({
      tool: Tool.of(declaration.tool),
      description: declaration.description,
      inputs: declaration.inputs.map((each) => ({
        ...each,
        schema: InputSchema.of(each.schema),
      })),
      approval: declaration.approval
        ? ApprovalNeeded.of(declaration.tool, declaration.approval.because)
        : null,
      providedBy: declaration.integrationName,
      inferredOutput: declaration.inferredOutput,
    });
  },
};
