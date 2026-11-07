import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type {
  RunStartGate,
  StartDecision,
  StartingRun,
} from '@work/application/ports/run-start-gates.port';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';

export class TaskRunStartGate implements RunStartGate {
  readonly owner = 'work';

  constructor(
    private readonly taskViews: TaskViewsPort,
    private readonly hooks: LifecycleHooksPort,
  ) {}

  async mayStart(run: StartingRun, until: Date): Promise<StartDecision> {
    if (run.requester.kind !== 'task') {
      return { kind: 'allowed' };
    }

    const view = await this.taskViews.of(run.requester.id, run.runId.value);

    return view
      ? this.hooks.before(view, { on: 'run.starting' }, until)
      : { kind: 'allowed' };
  }
}
