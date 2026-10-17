import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';
import type { ToolUsed } from '@work/domain/events/tool-used.event';

export class ToolUsedHooks {
  constructor(
    private readonly taskViews: TaskViewsPort,
    private readonly hooks: LifecycleHooksPort,
  ) {}

  async on(event: ToolUsed): Promise<void> {
    const taskView = await this.taskViews.of(
      event.taskId.value,
      event.runId.value,
    );

    if (!taskView) {
      return;
    }

    await this.hooks.after(
      taskView,
      {
        on: 'tool.used',
        tool: event.tool.value,
        inputs: event.inputs.values,
        output: event.output.answer,
        failed: event.failed,
      },
      event.occurrence,
    );
  }
}
