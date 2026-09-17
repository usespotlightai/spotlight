import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';

export const ToolDeclarationMapper = {
  toDeclared(declaration: ToolDeclaration): DeclaredTool {
    return DeclaredTool.of({
      tool: Tool.of(declaration.tool),
      description: declaration.description,
      inputs: declaration.inputs,
    });
  },
};
