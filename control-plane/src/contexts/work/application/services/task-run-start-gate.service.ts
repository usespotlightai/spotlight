import {
  type RunStartGate,
  type StartDecision,
  StartGateUnavailableError,
  type StartingRun,
} from '@runs/application/ports/run-start-gates.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';
import { WorkRequesters } from '@work/application/services/work-requesters';

const PROGRAMMING_ERRORS = [TypeError, RangeError, ReferenceError, SyntaxError];

const leavesHooksUnanswered = (error: unknown): error is Error =>
  error instanceof UpstreamError ||
  (error instanceof Error &&
    !(error instanceof DomainError) &&
    !(error instanceof ApplicationError) &&
    !PROGRAMMING_ERRORS.some((kind) => error instanceof kind));

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

    if (!view) {
      return { kind: 'allowed' };
    }

    try {
      return await this.hooks.before(view, { on: 'run.starting' }, until);
    } catch (error) {
      if (leavesHooksUnanswered(error)) {
        throw new StartGateUnavailableError(error.message);
      }

      throw error;
    }
  }
}
