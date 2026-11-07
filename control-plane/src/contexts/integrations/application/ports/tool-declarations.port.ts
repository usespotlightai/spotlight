import type { DeclaredTool } from '@integrations/application/dto/declared-tool.dto';
import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';

export const TOOL_DECLARATIONS = Symbol('TOOL_DECLARATIONS');

export interface ToolDeclarationsPort {
  declared(
    definitions: readonly DefinedIntegration[],
    tools: readonly string[],
  ): Promise<readonly DeclaredTool[]>;
}
