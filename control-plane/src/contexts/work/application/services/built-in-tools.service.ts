import type {
  ReachableTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import {
  BUILT_IN_TOOLS,
  builtInTool,
} from '@work/domain/services/built-in-tools';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export const BUILT_IN_TOOL_USES = Symbol('BUILT_IN_TOOL_USES');

export interface BuiltInToolUse<C extends ToolContext = ToolContext> {
  readonly tool: Tool;
  call(context: C, inputs: ToolInputs): Promise<unknown>;
}

export class BuiltInTools {
  constructor(private readonly uses: readonly BuiltInToolUse[]) {
    for (const each of BUILT_IN_TOOLS) {
      if (!uses.some((use) => use.tool.equals(each.declared.tool))) {
        throw new Error(
          `Spotlight declares ${each.declared.tool.value}, and nothing here uses it`,
        );
      }
    }
  }

  reach(tool: Tool, context: ToolContext): ReachableTool | null {
    const built = builtInTool(tool);
    const use = this.uses.find((each) => each.tool.equals(tool));

    return built && use && built.worksOn === context.kind
      ? {
          declared: built.declared,
          actingAs: null,
          wants: null,
          defaultFor: () => undefined,
          call: (inputs) => use.call(context, inputs),
        }
      : null;
  }
}
