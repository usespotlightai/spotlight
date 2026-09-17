import type { ContributedTaskTool } from '@work/application/ports/contributed-tools.port';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { BuiltInToolUse } from '@work/application/services/built-in-tools.service';
import { Tool } from '@work/domain/value-objects/tool.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

export class ContributedToolUse implements BuiltInToolUse<TaskToolContext> {
  readonly tool: Tool;

  constructor(private readonly contributed: ContributedTaskTool) {
    this.tool = Tool.of(contributed.tool);
  }

  call(context: TaskToolContext, inputs: ToolInputs): Promise<unknown> {
    return this.contributed.call(
      {
        runId: context.runId,
        taskId: context.taskId,
        workspaceId: context.workspaceId,
        stationCheck: context.stationCheck,
      },
      inputs.values,
    );
  }
}
