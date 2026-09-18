import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  BINDABLE_TASK_EVENTS,
  isBindableTaskEvent,
} from '@work/application/contracts/bindable-task-events.contract';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const task = TaskId.of('task_1');
const workspace = WorkspaceId.of('ws_1');
const station = StationId.of('station_1');

describe('the task events a team may bind to', () => {
  it('names exactly the kinds of the events the aggregate records for it', () => {
    const bindable = [
      new TaskOpened(task, workspace, station, false),
      new PullRequestOpened(task, workspace, PullRequestUrl.of('https://x/1')),
      new TaskAsked(task, workspace, station, null),
    ];

    expect(bindable.map((each) => each.kind).sort()).toEqual(
      [...BINDABLE_TASK_EVENTS].sort(),
    );
    expect(bindable.every((each) => isBindableTaskEvent(each.kind))).toBe(true);
  });

  it('does not bind an event kept to itself', () => {
    expect(
      isBindableTaskEvent(
        new TaskFinished(task, workspace, station, new Date()).kind,
      ),
    ).toBe(false);
  });
});
