import { CHANGE_REVIEW_PUBLICATIONS } from '@change-review/application/integration-events/change-review.publications';
import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { ChangeStackShaped } from '@change-review/domain/events/change-stack-shaped.event';
import { ReplayStackSettled } from '@change-review/domain/events/replay-stack-settled.event';
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
      false,
      false,
    );

    expect(
      CHANGE_REVIEW_PUBLICATIONS.filter(
        (each) => each.from === checked.kind,
      ).map((each) => each.publish(checked, new Date())),
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
  it('publishes what the change cohorts of a run’s stack set out to do, leaving incidental ones out', () => {
    const shaped = new ChangeStackShaped(
      ChangeStackId.of('stack_1'),
      RunId.of('run_1'),
      TaskId.of('task_1'),
      WorkspaceId.of('ws_1'),
      [
        {
          kind: 'change',
          title: 'Fix retries',
          intent: 'Stop dropping uploads',
        },
        { kind: 'incidental', title: 'Lockfile', intent: 'Bumped' },
      ],
      new Date('2026-09-30T10:00:00Z'),
    );

    expect(
      CHANGE_REVIEW_PUBLICATIONS.filter(
        (each) => each.from === shaped.kind,
      ).map((each) => each.publish(shaped, new Date())),
    ).toEqual([
      {
        kind: 'change-review.change-stack-shaped.v1',
        runId: 'run_1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        changeTitles: ['Fix retries'],
        changeIntents: ['Stop dropping uploads'],
        at: '2026-09-30T10:00:00.000Z',
      },
    ]);
  });

  it('publishes a replay’s checked change as its own, never as a task’s', () => {
    const checked = new ChangeStackChecked(
      ChangeStackId.of('stack_1'),
      RunId.of('replay_1'),
      null,
      WorkspaceId.of('ws_1'),
      true,
      true,
      false,
    );

    expect(
      CHANGE_REVIEW_PUBLICATIONS.filter(
        (each) => each.from === checked.kind,
      ).map((each) => each.publish(checked, new Date())),
    ).toEqual([
      {
        kind: 'change-review.replay-change-checked.v1',
        runId: 'replay_1',
        workspaceId: 'ws_1',
        passed: true,
      },
    ]);
  });

  it('publishes a recheck of a replay’s change apart from its first check', () => {
    const rechecked = new ChangeStackChecked(
      ChangeStackId.of('stack_1'),
      RunId.of('replay_1'),
      null,
      WorkspaceId.of('ws_1'),
      false,
      true,
      true,
    );

    expect(
      CHANGE_REVIEW_PUBLICATIONS.filter(
        (each) => each.from === rechecked.kind,
      ).map((each) => each.publish(rechecked, new Date())),
    ).toEqual([
      {
        kind: 'change-review.replay-change-rechecked.v1',
        runId: 'replay_1',
        workspaceId: 'ws_1',
        passed: false,
      },
    ]);
  });

  it('publishes that a replay’s stack settled, so its replay can take it up', () => {
    const settled = new ReplayStackSettled(
      ChangeStackId.of('stack_1'),
      RunId.of('replay_1'),
      WorkspaceId.of('ws_1'),
    );

    expect(
      CHANGE_REVIEW_PUBLICATIONS.filter(
        (each) => each.from === settled.kind,
      ).map((each) => each.publish(settled, new Date())),
    ).toEqual([
      {
        kind: 'change-review.replay-stack-settled.v1',
        runId: 'replay_1',
        workspaceId: 'ws_1',
      },
    ]);
  });
});
