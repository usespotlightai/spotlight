import { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { StackChecked } from '@change-review/domain/events/stack-checked.event';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const STACK_ID = ChangeStackId.of('stack-1');
const RUN_ID = RunId.of('run-1');

const posting = () => {
  const posted: RunId[] = [];
  const postedForTask: TaskId[] = [];
  const reactions = new ChangeStackReactions({
    ofRun: async (runId) => void posted.push(runId),
    ofTask: async (taskId) => void postedForTask.push(taskId),
  });

  return { posted, postedForTask, reactions };
};

const checked = (
  trial: boolean,
  runId: RunId | null = RUN_ID,
  taskId: TaskId | null = null,
) =>
  new StackChecked(
    StackCheckId.first(STACK_ID),
    runId,
    taskId,
    WorkspaceId.of('ws_1'),
    true,
    trial,
    new Date('2026-10-02T09:30:00.000Z'),
  );

describe('ChangeStackReactions', () => {
  it('points the pull request at a stack once it completes or is checked', async () => {
    const { posted, reactions } = posting();

    await reactions.onCompleted(
      new ChangeStackCompleted(STACK_ID, RUN_ID, null, false),
    );
    await reactions.onChecked(checked(false));

    expect(posted).toEqual([RUN_ID, RUN_ID]);
  });

  it('never posts a comment for a trial’s stack, completed or checked', async () => {
    const { posted, reactions } = posting();

    await reactions.onCompleted(
      new ChangeStackCompleted(STACK_ID, RUN_ID, null, true),
    );
    await reactions.onChecked(checked(true));

    expect(posted).toEqual([]);
  });

  it('points the pull requests of the task at a pushed stack, which has no run', async () => {
    const { posted, postedForTask, reactions } = posting();
    const TASK = TaskId.of('task-1');

    await reactions.onCompleted(
      new ChangeStackCompleted(STACK_ID, null, TASK, false),
    );
    await reactions.onChecked(checked(false, null, TASK));

    expect(postedForTask).toEqual([TASK, TASK]);
    expect(posted).toEqual([]);
  });

  it('posts nothing for a stack of neither a run nor a task', async () => {
    const { posted, postedForTask, reactions } = posting();

    await reactions.onChecked(checked(false, null, null));

    expect([...posted, ...postedForTask]).toEqual([]);
  });
});
