import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';
import { ToolNotEnabledError } from '@work/domain/exceptions/tool-not-enabled.error';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

export interface ToolGrantingRun {
  readonly actsBeyondItself: boolean;
  readonly manifest: readonly string[];
}

export const ToolEnablement = {
  enabledFor(tool: Tool, run: ToolGrantingRun): boolean {
    return run.manifest.includes(tool.value);
  },

  assertEnabled(tool: Tool, run: ToolGrantingRun): void {
    if (!ToolEnablement.enabledFor(tool, run)) {
      throw new ToolNotEnabledError(tool.value);
    }
  },

  assertCallable(declared: DeclaredTool, run: ToolGrantingRun): void {
    if (!run.actsBeyondItself && !declared.changesNothing) {
      throw new NotAllowedForIsolatedRunError(
        `call ${declared.tool.value}, which can change data or needs a person’s approval`,
      );
    }
  },
};
