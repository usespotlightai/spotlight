import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { BINDABLE_TASK_EVENTS } from '@work/application/contracts/bindable-task-events.contract';
import {
  bindableTaskEventOf,
  NOTICED_TASK_EVENT_KINDS,
} from '@work/application/mappers/bindable-task-event.mapper';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { describe, expect, it } from 'vitest';

const task = TaskId.of('task_1');
const workspace = WorkspaceId.of('ws_1');
const station = StationId.of('station_1');

describe('bindableTaskEventOf', () => {
  it('binds every published task event from one event the task records', () => {
    const noticed = [
      new TaskOpened(
        task,
        workspace,
        TeamId.of('team_1'),
        LineId.of('line_1'),
        station,
        null,
        new Date(),
        false,
      ),
      new PullRequestOpened(
        task,
        workspace,
        TeamId.of('team_1'),
        PullRequestUrl.of('https://x/1'),
        new Date(),
      ),
      new TaskAsked(task, workspace, station, null, new Date()),
      new TaskFinished(task, workspace, station, new Date()),
      new TaskFailed(
        task,
        workspace,
        TeamId.of('team_1'),
        station,
        TaskFailure.fromRun('exhausted'),
        null,
        new Date(),
      ),
    ];

    expect(noticed.map(bindableTaskEventOf).sort()).toEqual(
      [...BINDABLE_TASK_EVENTS].sort(),
    );
  });

  it('hears exactly the events it binds', () => {
    expect([...NOTICED_TASK_EVENT_KINDS].sort()).toEqual(
      [
        'task.asked',
        'task.failed',
        'task.finished',
        'task.opened',
        'task.pull-request-opened',
      ].sort(),
    );
  });

  it('does not hear an event the task keeps to itself', () => {
    expect(NOTICED_TASK_EVENT_KINDS).not.toContain(
      new TaskDeleted(task, workspace).kind,
    );
  });
});
