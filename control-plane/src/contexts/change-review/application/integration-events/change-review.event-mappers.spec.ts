import { CHANGE_REVIEW_EVENT_MAPPERS } from '@change-review/application/integration-events/change-review.event-mappers';
import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { ChangeStackReady } from '@change-review/domain/events/change-stack-ready.event';
import { ReplayStackCompleted } from '@change-review/domain/events/replay-stack-completed.event';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

describe('CHANGE_REVIEW_EVENT_MAPPERS', () => {
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
      CHANGE_REVIEW_EVENT_MAPPERS.filter(
        (each) => each.from === checked.kind,
      ).map((each) => each.map(checked, new Date())),
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
    const ready = new ChangeStackReady(
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
      CHANGE_REVIEW_EVENT_MAPPERS.filter(
        (each) => each.from === ready.kind,
      ).map((each) => each.map(ready, new Date())),
    ).toEqual([
      {
        kind: 'change-review.change-stack-ready.v1',
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
      CHANGE_REVIEW_EVENT_MAPPERS.filter(
        (each) => each.from === checked.kind,
      ).map((each) => each.map(checked, new Date())),
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
      CHANGE_REVIEW_EVENT_MAPPERS.filter(
        (each) => each.from === rechecked.kind,
      ).map((each) => each.map(rechecked, new Date())),
    ).toEqual([
      {
        kind: 'change-review.replay-change-rechecked.v1',
        runId: 'replay_1',
        workspaceId: 'ws_1',
        passed: false,
      },
    ]);
  });

  it('publishes that a replay’s stack completed, so its replay can take it up', () => {
    const completed = new ReplayStackCompleted(
      ChangeStackId.of('stack_1'),
      RunId.of('replay_1'),
      WorkspaceId.of('ws_1'),
    );

    expect(
      CHANGE_REVIEW_EVENT_MAPPERS.filter(
        (each) => each.from === completed.kind,
      ).map((each) => each.map(completed, new Date())),
    ).toEqual([
      {
        kind: 'change-review.replay-stack-completed.v1',
        runId: 'replay_1',
        workspaceId: 'ws_1',
      },
    ]);
  });
});
