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
import { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { InboxRequestOpened } from '@work/domain/events/inbox-request-opened.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import type { InboxRequestRepository } from '@work/domain/repositories/inbox-request.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';
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

const gradeRequest = (task: Task) =>
  InboxRequest.create({
    id: InboxRequestId.of('request_1'),
    workspaceId: WORKSPACE,
    taskId: task.id,
    form: 'grade',
    about: InboxRequestSubject.of('decision_set_1'),
    now: new Date('2026-09-17T09:30:00.000Z'),
  });

const notifying = (
  marks: readonly Mark[] = [],
  markedTask: Task | null = null,
  requestOf: (task: Task) => InboxRequest | null = gradeRequest,
) => {
  const task = handed();
  const request = requestOf(task);
  const save = vi.fn<(task: Task) => Promise<void>>(async () => {});
  const notify = vi.fn(async () => marks);
  const notifyRequest = vi.fn(async () => marks);
  const handler = new NotifyOutsideTools(
    {
      find: async () => task,
      findByCorrelation: async () => (markedTask ? [markedTask] : []),
      owningPullRequest: async () => null,
      reviewingPullRequest: async () => null,
      holdingMark: async () => [],
      save,
    } as unknown as TaskRepository,
    { find: async () => request } as unknown as InboxRequestRepository,
    { notify, notifyRequest } satisfies OutboundTaskNotifier,
    { inTransaction: (work) => work() } satisfies TransactionPort,
    { now: () => new Date('2026-09-17T10:00:00.000Z'), sleep: async () => {} },
  );

  return { handler, task, request, save, notify, notifyRequest };
};

const opened = (task: Task) =>
  new InboxRequestOpened(
    InboxRequestId.of('request_1'),
    WORKSPACE,
    task.id,
    new Date('2026-09-17T09:30:00.000Z'),
  );

describe('NotifyOutsideTools', () => {
  it('tells outside tools a person is being asked', async () => {
    const { handler, task, notify } = notifying();

    await handler.on(
      new TaskAsked(task.id, WORKSPACE, STATION, null, new Date()),
    );

    expect(notify).toHaveBeenCalledWith(task, 'task.asked');
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

    expect(notify).toHaveBeenCalledWith(task, 'task.opened');
  });

  it('tells outside tools of a pull request the task opened', async () => {
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

    expect(notify).toHaveBeenCalledWith(task, 'task.pull-request-opened');
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

  it('tells outside tools of a request waiting in the inbox', async () => {
    const { handler, task, request, notifyRequest } = notifying();

    await handler.onInboxRequestOpened(opened(task));

    expect(notifyRequest).toHaveBeenCalledWith(task, request);
  });

  it('records the marks a tool hands back for an inbox request onto its task', async () => {
    const { handler, task, save } = notifying([
      Mark.of('slack.thread', '170.9'),
    ]);

    await handler.onInboxRequestOpened(opened(task));

    expect(save.mock.calls[0]?.[0].marks.map((each) => each.kind)).toContain(
      'slack.thread',
    );
  });

  it('keeps quiet about an inbox request resolved before the tools heard of it', async () => {
    const { handler, task, notifyRequest } = notifying([], null, (each) =>
      gradeRequest(each).resolve(new Date('2026-09-17T09:40:00.000Z')),
    );

    await handler.onInboxRequestOpened(opened(task));

    expect(notifyRequest).not.toHaveBeenCalled();
  });

  it('keeps quiet about an inbox request that no longer exists', async () => {
    const { handler, task, notifyRequest } = notifying([], null, () => null);

    await handler.onInboxRequestOpened(opened(task));

    expect(notifyRequest).not.toHaveBeenCalled();
  });
});
