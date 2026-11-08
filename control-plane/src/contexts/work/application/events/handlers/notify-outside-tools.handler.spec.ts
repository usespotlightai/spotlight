import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NotifyOutsideTools } from '@work/application/events/handlers/notify-outside-tools.handler';
import type { OutboundTaskNotifier } from '@work/application/services/outside-task-notices.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const STATION = StationId.of('station_1');

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const handed = () =>
  Task.add({
    line: delivery(WORKSPACE.value, STATION.value),
    at: STATION,
    title: TaskTitle.of('Drain the queue'),
    rank: TaskRank.of('i'),
    now: new Date('2026-09-17T09:00:00.000Z'),
    newId: () => 'task_1',
  });

const notifying = (
  marks: readonly Mark[] = [],
  markedTask: Task | null = null,
) => {
  const task = handed();
  const save = vi.fn(async (_: Task) => {});
  const notify = vi.fn(async () => marks);
  const handler = new NotifyOutsideTools(
    {
      find: async () => task,
      findByCorrelation: async () => (markedTask ? [markedTask] : []),
      holdingMark: async () => [],
      save,
    } as unknown as TaskRepository,
    { notify } satisfies OutboundTaskNotifier,
    { inTransaction: (work) => work() } satisfies TransactionPort,
    { now: () => new Date('2026-09-17T10:00:00.000Z'), sleep: async () => {} },
  );

  return { handler, task, save, notify };
};

describe('NotifyOutsideTools', () => {
  it('tells outside tools a person is being asked', async () => {
    const { handler, task, notify } = notifying();

    await handler.on(
      new TaskAsked(task.id, WORKSPACE, STATION, null, new Date()),
    );

    expect(notify).toHaveBeenCalledWith(task, 'task.asked', null);
  });

  it('tells outside tools of a task opened from what they said', async () => {
    const { handler, task, notify } = notifying();

    await handler.on(
      new TaskOpened(
        task.id,
        WORKSPACE,
        TeamId.of('team_1'),
        LineId.of('line_1'),
        STATION,
        null,
        new Date(),
        true,
      ),
    );

    expect(notify).toHaveBeenCalledWith(task, 'task.opened', null);
  });

  it('names the pull request that opened, not the first one of the task', async () => {
    const { handler, task, notify } = notifying();
    const docs = PullRequestUrl.of('https://github.com/acme/docs/pull/3');

    await handler.on(
      new PullRequestOpened(
        task.id,
        WORKSPACE,
        TeamId.of('team_1'),
        docs,
        new Date(),
      ),
    );

    expect(notify).toHaveBeenCalledWith(task, 'task.pull-request-opened', docs);
  });

  it('keeps quiet about a task somebody opened here', async () => {
    const { handler, task, notify } = notifying();

    await handler.on(
      new TaskOpened(
        task.id,
        WORKSPACE,
        TeamId.of('team_1'),
        LineId.of('line_1'),
        STATION,
        null,
        new Date(),
        false,
      ),
    );

    expect(notify).not.toHaveBeenCalled();
  });

  it('records the marks a tool hands back onto the task', async () => {
    const { handler, task, save } = notifying([
      Mark.of('slack.thread', '170.9'),
    ]);

    await handler.on(
      new TaskAsked(task.id, WORKSPACE, STATION, null, new Date()),
    );

    expect(save.mock.calls[0]?.[0].marks.map((each) => each.kind)).toContain(
      'slack.thread',
    );
  });

  it('marks only the task told about, leaving the release of an older holder to its own reaction', async () => {
    const thread = Mark.of('slack.thread', '170.9');
    const { handler, task, save } = notifying([thread]);

    await handler.on(
      new TaskAsked(task.id, WORKSPACE, STATION, null, new Date()),
    );

    const [marked] = save.mock.calls.map(([each]) => each);
    expect(save).toHaveBeenCalledTimes(1);
    expect(marked?.marks).toEqual([thread]);
    expect(marked?.pullEvents().map((each) => each.kind)).toContain(
      'task.marked',
    );
  });

  it('writes nothing where no tool handed a mark back', async () => {
    const { handler, task, save } = notifying();

    await handler.on(
      new TaskAsked(task.id, WORKSPACE, STATION, null, new Date()),
    );

    expect(save).not.toHaveBeenCalled();
  });
});
