import { CHANGE_REVIEW_PUBLICATIONS } from '@change-review/application/integration-events/change-review.publications';
import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

describe('CHANGE_REVIEW_PUBLICATIONS', () => {
  it('publishes whether a run’s change passed its checks, and for which task', () => {
    const checked = new ChangeStackChecked(
      ChangeStackId.of('stack_1'),
      RunId.of('run_1'),
      TaskId.of('task_1'),
      WorkspaceId.of('ws_1'),
      false,
    );

    expect(
      CHANGE_REVIEW_PUBLICATIONS.filter(
        (each) => each.from === checked.kind,
      ).map((each) => each.publish(checked)),
    ).toEqual([
      {
        kind: 'change-review.change-checked.v1',
        runId: 'run_1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        passed: false,
      },
    ]);
  });
});
