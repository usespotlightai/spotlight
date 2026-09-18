import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NotifyOutsideTools } from '@work/application/events/handlers/notify-outside-tools.handler';
import type { OutboundTaskNotifierPort } from '@work/application/ports/outbound-task-notifier.port';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const STATION = StationId.of('station_1');

const delivery = (workspaceId = 'ws_1', standsAt = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of(standsAt),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const held = () =>
  Task.add({
    line: delivery(WORKSPACE.value, STATION.value),
    at: STATION,
    title: TaskTitle.of('Drain the queue'),
    rank: TaskRank.of('i'),
    now: new Date('2026-09-17T09:00:00.000Z'),
    newId: () => 'task_1',
  });

const notifying = (marks: readonly Mark[] = [], wearer: Task | null = null) => {
  const task = held();
  const save = vi.fn(async (_: Task) => {});
  const notify = vi.fn(async () => marks);
  const handler = new NotifyOutsideTools(
    {
      find: async () => task,
      holding: async () => wearer,
      save,
    } as unknown as TaskRepository,
    { notify } satisfies OutboundTaskNotifierPort,
    { run: (work) => work() } satisfies TransactionPort,
  );

  return { handler, task, save, notify };
};

describe('NotifyOutsideTools', () => {
  it('tells outside tools a person is being asked', async () => {
    const { handler, task, notify } = notifying();

    await handler.on(new TaskAsked(task.id, WORKSPACE, STATION, null));

    expect(notify).toHaveBeenCalledWith(task, 'task.asked');
  });

  it('tells outside tools of a task opened from what they said', async () => {
    const { handler, task, notify } = notifying();

    await handler.on(new TaskOpened(task.id, WORKSPACE, STATION, true));

    expect(notify).toHaveBeenCalledWith(task, 'task.opened');
  });

  it('keeps quiet about a task somebody opened here', async () => {
    const { handler, task, notify } = notifying();

    await handler.on(new TaskOpened(task.id, WORKSPACE, STATION, false));

    expect(notify).not.toHaveBeenCalled();
  });

  it('records the marks a tool hands back onto the task', async () => {
    const { handler, task, save } = notifying([
      Mark.of('slack.thread', '170.9'),
    ]);

    await handler.on(new TaskAsked(task.id, WORKSPACE, STATION, null));

    expect(save.mock.calls[0]?.[0].marks.map((each) => each.kind)).toContain(
      'slack.thread',
    );
  });

  it('takes a mark from the task that wore it, newest claim winning', async () => {
    const thread = Mark.of('slack.thread', '170.9');
    const before = Task.add({
      line: delivery(WORKSPACE.value, STATION.value),
      at: STATION,
      title: TaskTitle.of('An older thread'),
      rank: TaskRank.of('h'),
      now: new Date('2026-09-17T08:00:00.000Z'),
      newId: () => 'task_0',
    }).markedBy(thread);
    before.pullEvents();
    const { handler, task, save } = notifying([thread], before);

    await handler.on(new TaskAsked(task.id, WORKSPACE, STATION, null));

    const [given, taker] = save.mock.calls.map(([each]) => each);
    expect(given?.id.value).toBe('task_0');
    expect(given?.marks).toEqual([]);
    expect(taker?.marks).toEqual([thread]);
  });

  it('writes nothing where no tool handed a mark back', async () => {
    const { handler, task, save } = notifying();

    await handler.on(new TaskAsked(task.id, WORKSPACE, STATION, null));

    expect(save).not.toHaveBeenCalled();
  });
});
