import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ToolUse } from '@work/domain/value-objects/tool-use.vo';

export const RUN_TOOLS = Symbol('RUN_TOOLS');

export interface RunToolsReaderPort {
  toolsFor(runId: RunId): Promise<ToolUse | null>;
}
