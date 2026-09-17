import type { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import type { ToolInputValues } from '@work/application/contracts/tools.contract';
import type {
  ContributedTaskTool,
  TaskToolCall,
} from '@work/application/ports/contributed-tools.port';

const textOf = (inputs: ToolInputValues, name: string): string | null => {
  const value = inputs[name];

  return typeof value === 'string' ? value : null;
};

export class ChangeStackToolUse implements ContributedTaskTool {
  readonly tool = 'change-stack';

  constructor(private readonly drafting: DraftChangeStack) {}

  async call(call: TaskToolCall, inputs: ToolInputValues): Promise<unknown> {
    const stack = await this.drafting.begin(
      { id: call.runId, taskId: call.taskId, workspaceId: call.workspaceId },
      {
        diff: textOf(inputs, 'diff') ?? '',
        repository: textOf(inputs, 'repository'),
        check: call.stationCheck,
      },
    );

    const changes = stack.diff.hunks.length;
    const files = stack.diff.files.length;

    return `Drafting a change stack of ${changes} ${changes === 1 ? 'change' : 'changes'} across ${files} ${files === 1 ? 'file' : 'files'}. It shows on this run’s page once it is ready; there is nothing more to do here.`;
  }
}
