import type { CalledTool } from '@work/domain/value-objects/called-tool.vo';

export const HARNESS_TOOL_NAMES = Symbol('HARNESS_TOOL_NAMES');

export interface HarnessToolNamesPort {
  toolFor(title: string, kind: string): CalledTool | null;
}
