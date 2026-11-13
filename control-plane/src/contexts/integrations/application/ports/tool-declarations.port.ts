import type { DeclaredTool } from '@integrations/application/dto/declared-tool.dto';
import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';

export const TOOL_DECLARATIONS = Symbol('TOOL_DECLARATIONS');

export interface ToolDeclarationsPort {
  declared(
    definitions: readonly DefinedIntegration[],
    tools: readonly string[],
  ): Promise<readonly DeclaredTool[]>;

  enabledOnMarks(
    definitions: readonly DefinedIntegration[],
    kinds: readonly MarkKind[],
  ): readonly ToolName[];
}
