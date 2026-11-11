import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { ToolContext } from '@work/application/ports/integration-tools.port';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export const BUILT_IN_TOOL_USES = Symbol('BUILT_IN_TOOL_USES');

export interface BuiltInToolUse<C extends ToolContext = ToolContext> {
  readonly tool: Tool;
  call(context: C, inputs: ToolInputs): Promise<unknown>;
}
