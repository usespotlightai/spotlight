import { visibilityOf } from '@change-review/domain/value-objects/stack-visibility.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

describe('visibilityOf', () => {
  it('shows a stack through its task, even when a run made it', () => {
    expect(
      visibilityOf({ taskId: TaskId.of('task_1'), runId: RunId.of('run_1') }),
    ).toEqual({ kind: 'task', taskId: TaskId.of('task_1') });
  });

  it('shows a stack with no task through the run that made it', () => {
    expect(visibilityOf({ taskId: null, runId: RunId.of('run_1') })).toEqual({
      kind: 'run',
      runId: RunId.of('run_1'),
    });
  });

  it('shows a stack with neither to nobody', () => {
    expect(visibilityOf({ taskId: null, runId: null })).toBeNull();
  });
});
