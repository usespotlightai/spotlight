import {
  BINDABLE_TASK_EVENTS,
  isBindableTaskEvent,
} from '@domain/events/bindable-task-events';
import { PullRequestOpened } from '@domain/events/pull-request-opened.event';
import { TaskAsked } from '@domain/events/task-asked.event';
import { TaskFinished } from '@domain/events/task-finished.event';
import { TaskOpened } from '@domain/events/task-opened.event';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const task = TaskId.of('task_1');
const workspace = WorkspaceId.of('ws_1');
const station = StationId.of('station_1');

describe('the task events a team may bind to', () => {
  it('names exactly the kinds of the events the aggregate records for it', () => {
    const bindable = [
      new TaskOpened(task, workspace, station),
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
