import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';

export interface ToolGrantingRun {
  readonly actsBeyondItself: boolean;
  readonly manifest: readonly string[];
}

export const ToolEnablement = {
  enabledFor(tool: Tool, run: ToolGrantingRun): boolean {
    return run.actsBeyondItself && run.manifest.includes(tool.value);
  },

  assertEnabled(tool: Tool, run: ToolGrantingRun): void {
    if (!ToolEnablement.enabledFor(tool, run)) {
      throw new ToolNotEnabledError(tool.value);
    }
  },
};
