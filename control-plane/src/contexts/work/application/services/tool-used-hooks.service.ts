import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type { ToolUsed } from '@work/domain/events/tool-used.event';

export class ToolUsedHooks {
  constructor(
    private readonly hookedTasks: HookedTasksPort,
    private readonly hooks: LifecycleHooksPort,
  ) {}

  async on(event: ToolUsed): Promise<void> {
    const hooked = await this.hookedTasks.of(
      event.taskId.value,
      event.runId.value,
    );

    if (!hooked) {
      return;
    }

    await this.hooks.after(
      hooked,
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
