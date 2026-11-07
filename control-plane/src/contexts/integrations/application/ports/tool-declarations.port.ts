import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';

export const TOOL_DECLARATIONS = Symbol('TOOL_DECLARATIONS');

export interface ToolDeclarationsPort {
  declared(
    definitions: readonly DefinedIntegration[],
    tools: readonly string[],
  ): Promise<readonly ToolDeclaration[]>;
}
