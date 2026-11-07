import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type {
  RunStartGate,
  StartDecision,
  StartingRun,
} from '@work/application/ports/run-start-gates.port';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';
import { WorkRequesters } from '@work/application/services/work-requesters';

export class TaskRunStartGate implements RunStartGate {
  readonly owner = WorkRequesters.owner;

  constructor(
    private readonly taskViews: TaskViewsPort,
    private readonly hooks: LifecycleHooksPort,
  ) {}

  async mayStart(run: StartingRun, until: Date): Promise<StartDecision> {
    const taskId = WorkRequesters.taskOf(run.requester);

    if (!taskId) {
      return { kind: 'allowed' };
    }

    const view = await this.taskViews.of(taskId.value, run.runId.value);

    return view
      ? this.hooks.before(view, { on: 'run.starting' }, until)
      : { kind: 'allowed' };
  }
}
