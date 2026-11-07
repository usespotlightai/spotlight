import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { BuiltInToolUse } from '@work/application/ports/built-in-tool-uses.port';
import type {
  ResolvedTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import type { ChatToolExtensions } from '@work/application/services/chat-tool-extensions.service';
import {
  BUILT_IN_TOOLS,
  builtInTool,
} from '@work/domain/services/built-in-tools';

export class BuiltInTools {
  constructor(
    private readonly uses: readonly BuiltInToolUse[],
    private readonly extensions: ChatToolExtensions,
  ) {
    for (const each of BUILT_IN_TOOLS) {
      if (!uses.some((use) => use.tool.equals(each.declared.tool))) {
        throw new Error(
          `Spotlight declares ${each.declared.tool.value}, and nothing here uses it`,
        );
      }
    }
  }

  resolve(tool: Tool, context: ToolContext): ResolvedTool | null {
    const built = builtInTool(tool);
    const use = this.uses.find((each) => each.tool.equals(tool));

    if (!built && context.kind === 'chat') {
      return this.extensions.resolve(tool, context);
    }

    return built && use && built.worksOn === context.kind
      ? {
          declared: built.declared,
          actingAs: null,
          missing: null,
          personRule: null,
          defaultFor: () => undefined,
          call: (inputs) => use.call(context, inputs),
        }
      : null;
  }
}
