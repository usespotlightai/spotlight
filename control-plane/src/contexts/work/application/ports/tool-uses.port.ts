import type { RecordedToolUse } from '@work/domain/entities/recorded-tool-use.entity';

export const TOOL_USES = Symbol('TOOL_USES');

export interface ToolUsesPort {
  record(use: RecordedToolUse): Promise<void>;

  purgeBefore(before: Date, max: number): Promise<number>;
}
