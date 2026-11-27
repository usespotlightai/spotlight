import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { FIRST_PAGE } from '@work/application/dto/page.dto';
import type {
  TaskReaderPort,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import { ListTasksHandler } from '@work/application/queries/handlers/list-tasks.handler';
import { ListTasksQuery } from '@work/application/queries/list-tasks.query';
import {
  HARNESSED,
  linesWhere,
} from '@work/application/services/run-access.fake-spec';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import { TaskSearch } from '@work/domain/value-objects/task-search.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it, vi } from 'vitest';

const created = new Date('2026-08-27T09:15:00.000Z');

const summaries: TaskSummary[] = [
  {
    id: 'task_1',
    revision: 0,
    stationId: 'station_1',
    title: 'Fix the queue',
    description: null,
    attachments: [],
    createdAt: created,
    progress: null,
    awaitingReview: null,
    finished: false,
    running: false,
    pullRequests: [],
    createdBy: null,
    assignee: null,
    note: null,
    source: null,
    hold: null,
    runNotStarted: null,
  },
  {
    id: 'task_2',
    revision: 0,
    stationId: 'station_2',
    title: 'Write the spec',
    description: '## Steps',
    attachments: [],
    createdAt: created,
    progress: null,
    awaitingReview: null,
    finished: false,
    running: false,
    pullRequests: [],
    createdBy: null,
    assignee: null,
    note: null,
    source: null,
    hold: null,
    runNotStarted: null,
  },
];

const asDto = ({ running: _running, ...summary }: TaskSummary) => ({
  ...summary,
  handMoves: [],
  createdAt: summary.createdAt.toISOString(),
  waitingForYou: false,
  yourMessage: 'message',
});

const reader = (result: TaskSummary[]): TaskReaderPort => ({
  listForTeam: vi.fn().mockResolvedValue({ items: result, next: null }),
  findInTeam: vi.fn(),
});

const seeing = (sees = true, acts = sees, joined = acts): WorkAccess =>
  ({
    standingOn: vi.fn(async () =>
      TeamStanding.of({
        seesTeam: sees,
        actsOnTeam: acts,
        memberOfTeam: joined,
      }),
    ),
  }) as unknown as WorkAccess;

const ALICE = { id: 'user_alice', name: 'Alice', image: null };

const asking = (
  assignee: TaskSummary['assignee'],
  askedOf: string | null = null,
): TaskSummary => ({
  ...summaries[0],
  assignee,
  awaitingReview: {
    conversationId: 'task_1:3',
    ask: askedOf
      ? {
          approval: { open: true, askedOf: UserId.of(askedOf) },
          connectionAsk: null,
        }
      : null,
  },
});

const waitingFor = async (
  summary: TaskSummary,
  viewer: string,
  access = seeing(),
) =>
  (
    await new ListTasksHandler(reader([summary]), access, linesWhere()).execute(
      new ListTasksQuery('team_1', viewer, 'board', null, FIRST_PAGE),
    )
  )?.items[0]?.waitingForYou;

const held = (chatId: string | null): TaskSummary => ({
  ...summaries[0],
  hold: {
    by: { id: 'user_2', name: 'Maya Chen', image: null },
    startedAt: created,
    runId: 'run_1',
    heldMoveTo: null,
    chatId,
  },
});

const holdOf = async (summary: TaskSummary, access: WorkAccess) =>
  (await handle(reader([summary]), access))?.items[0]?.hold;

const handle = (tasks: TaskReaderPort, access = seeing()) =>
  new ListTasksHandler(tasks, access, linesWhere()).execute(
    new ListTasksQuery('team_1', 'user_1', 'board', null, FIRST_PAGE),
  );

describe('ListTasksHandler', () => {
  it('lists where a person may send a finished task back, as its line decides', async () => {
    let next = 0;
    const line = deliveryLineOf({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      newId: () => `station_${++next}`,
    });
    const at = (key: string) =>
      line.stations.find((each) => each.key.value === key)?.id.value as string;
    const lines = { ofTeam: async () => [line] } as never;
    const sentBack = async (finished: boolean) =>
      (
        await new ListTasksHandler(
          reader([{ ...summaries[0], stationId: at('code-review'), finished }]),
          seeing(),
          lines,
        ).execute(
          new ListTasksQuery('team_1', 'user_1', 'board', null, FIRST_PAGE),
        )
      )?.items[0]?.handMoves.flatMap((each) =>
        each.sendsBack ? [each.stationId] : [],
      );

    await expect(sentBack(true)).resolves.toEqual([
      at('triage'),
      at('spec'),
      at('implementation'),
    ]);
    await expect(sentBack(false)).resolves.toEqual([]);
  });

  it('hands back each task with the station it is at', async () => {
    await expect(handle(reader(summaries))).resolves.toEqual({
      items: summaries.map(asDto),
      next: null,
    });
  });

  it('answers with nothing for a team the caller cannot see', async () => {
    await expect(handle(reader([]), seeing(false))).resolves.toBeNull();
  });

  it('asks the reader for the open tasks', async () => {
    const tasks = reader([]);

    await handle(tasks);

    expect(tasks.listForTeam).toHaveBeenCalledWith(expect.anything(), {
      state: 'board',
      search: null,
    });
  });

  it('asks the reader for a page of completed tasks on a line', async () => {
    const tasks = reader([]);

    await new ListTasksHandler(tasks, seeing(), linesWhere()).execute(
      new ListTasksQuery(
        'team_1',
        'user_1',
        'completed-station',
        'line_1',
        FIRST_PAGE,
      ),
    );

    expect(tasks.listForTeam).toHaveBeenCalledWith(expect.anything(), {
      state: 'completed-station',
      lineId: 'line_1',
      search: null,
      page: FIRST_PAGE,
    });
  });

  it('asks the reader for the completed tasks that hold each word searched for', async () => {
    const tasks = reader([]);

    await new ListTasksHandler(tasks, seeing(), linesWhere()).execute(
      new ListTasksQuery(
        'team_1',
        'user_1',
        'completed-station',
        null,
        FIRST_PAGE,
        ' Better-SQLite3  scaffold ',
      ),
    );

    expect(tasks.listForTeam).toHaveBeenCalledWith(expect.anything(), {
      state: 'completed-station',
      lineId: null,
      search: TaskSearch.of('better-sqlite3 scaffold'),
      page: FIRST_PAGE,
    });
  });

  it('refuses an empty search', async () => {
    await expect(
      new ListTasksHandler(reader([]), seeing(), linesWhere()).execute(
        new ListTasksQuery('team_1', 'user_1', 'board', null, FIRST_PAGE, ' '),
      ),
    ).rejects.toThrow('Task search must not be empty.');
  });

  it('answers with an empty board rather than nothing', async () => {
    await expect(handle(reader([]))).resolves.toEqual({
      items: [],
      next: null,
    });
  });

  it('tells the caller they can drive and resume a task someone else put on hold', async () => {
    await expect(holdOf(held(null), seeing())).resolves.toMatchObject({
      viewerDrives: true,
      viewerEnds: true,
    });
  });

  it('tells a caller who only sees the team that they can do neither', async () => {
    await expect(
      holdOf(held(null), seeing(true, false)),
    ).resolves.toMatchObject({
      viewerDrives: false,
      viewerEnds: false,
    });
  });

  describe('waiting for you', () => {
    it('waits for Alice, who holds the task, and not for Bob on the same team', async () => {
      await expect(waitingFor(asking(ALICE), 'user_alice')).resolves.toBe(true);
      await expect(waitingFor(asking(ALICE), 'user_bob')).resolves.toBe(false);
    });

    it('waits for every member of the team while nobody holds the task', async () => {
      await expect(waitingFor(asking(null), 'user_bob')).resolves.toBe(true);
    });

    it('does not wait for a workspace admin who is not on the team, because answering would assign the task to them', async () => {
      await expect(
        waitingFor(asking(null), 'user_admin', seeing(true, true, false)),
      ).resolves.toBe(false);
    });

    it('waits for the person an approval names, though someone else holds the task', async () => {
      await expect(
        waitingFor(asking(ALICE, 'user_bob'), 'user_bob'),
      ).resolves.toBe(true);
    });

    it('waits for nobody who only sees the team', async () => {
      await expect(
        waitingFor(asking(null), 'user_bob', seeing(true, false)),
      ).resolves.toBe(false);
    });

    it('hands back the question without who it asks', async () => {
      const found = await new ListTasksHandler(
        reader([asking(ALICE, 'user_bob')]),
        seeing(),
        linesWhere(),
      ).execute(
        new ListTasksQuery('team_1', 'user_bob', 'board', null, FIRST_PAGE),
      );

      expect(found?.items[0]?.awaitingReview).toEqual({
        conversationId: 'task_1:3',
      });
    });
  });

  describe('your message', () => {
    const yourMessage = async (
      summary: TaskSummary,
      viewer: string,
      access = seeing(),
    ) =>
      (
        await new ListTasksHandler(
          reader([summary]),
          access,
          linesWhere(),
        ).execute(
          new ListTasksQuery('team_1', viewer, 'board', null, FIRST_PAGE),
        )
      )?.items[0]?.yourMessage;
    const harnessed = { ...summaries[0], stationId: HARNESSED };

    it('answers the open question with a message from Alice, who holds the task, and refuses one from Bob', async () => {
      await expect(yourMessage(asking(ALICE), 'user_alice')).resolves.toBe(
        'answer',
      );
      await expect(yourMessage(asking(ALICE), 'user_bob')).resolves.toBe(
        'awaits-another',
      );
    });

    it('adds a message to a task at a station with a harness, from a member or an admin off the team, and puts nothing on hold', async () => {
      await expect(yourMessage(harnessed, 'user_bob')).resolves.toBe('message');
      await expect(
        yourMessage(harnessed, 'user_admin', seeing(true, true, false)),
      ).resolves.toBe('message');
    });

    it('adds a message to a task at a station with no harness', async () => {
      await expect(yourMessage(summaries[0], 'user_bob')).resolves.toBe(
        'message',
      );
    });

    it('refuses a message from anybody who only sees the team', async () => {
      await expect(
        yourMessage(harnessed, 'user_bob', seeing(true, false)),
      ).resolves.toBe('not-acting');
    });
  });

  it('keeps a task that another person’s agent chat holds from the caller', async () => {
    await expect(holdOf(held('chat_1'), seeing())).resolves.toMatchObject({
      viewerDrives: false,
      viewerEnds: false,
    });
  });

  it('lists where a person may move each task by hand, as its line decides', async () => {
    let next = 0;
    const line = deliveryLineOf({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      newId: () => `station_${++next}`,
    });
    const at = (key: string) =>
      line.stations.find((each) => each.key.value === key)?.id.value as string;
    const moves = await new ListTasksHandler(
      reader([{ ...summaries[0], stationId: at('implementation') }]),
      seeing(),
      { ofTeam: async () => [line] } as never,
    ).execute(
      new ListTasksQuery('team_1', 'user_1', 'board', null, FIRST_PAGE),
    );

    expect(moves?.items[0]?.handMoves).toEqual([
      { stationId: at('backlog'), denial: null, skips: [], sendsBack: false },
      {
        stationId: at('triage'),
        denial: 'between-work-stations',
        skips: [],
        sendsBack: false,
      },
      {
        stationId: at('spec'),
        denial: 'between-work-stations',
        skips: [],
        sendsBack: false,
      },
      {
        stationId: at('implementation'),
        denial: null,
        skips: [],
        sendsBack: false,
      },
      {
        stationId: at('code-review'),
        denial: 'between-work-stations',
        skips: [],
        sendsBack: false,
      },
      { stationId: at('completed'), denial: null, skips: [], sendsBack: false },
    ]);
  });

  it('opens the stations its station passes work to while the task waits on a question, and not while it waits on an approval', async () => {
    let next = 0;
    const line = deliveryLineOf({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      newId: () => `station_${++next}`,
      harness: HarnessId.of('dev'),
    });
    const at = (key: string) =>
      line.stations.find((each) => each.key.value === key)?.id.value as string;
    const openFrom = async (summary: TaskSummary) =>
      (
        await new ListTasksHandler(reader([summary]), seeing(), {
          ofTeam: async () => [line],
        } as never).execute(
          new ListTasksQuery('team_1', 'user_1', 'board', null, FIRST_PAGE),
        )
      )?.items[0]?.handMoves
        .filter((move) => move.denial === null)
        .map((move) => move.stationId);
    const atTriage = { ...summaries[0], stationId: at('triage') };

    await expect(
      openFrom({
        ...atTriage,
        awaitingReview: {
          conversationId: 'task_1:3',
          ask: { approval: null, connectionAsk: null },
        },
      }),
    ).resolves.toEqual([
      at('backlog'),
      at('triage'),
      at('spec'),
      at('implementation'),
      at('completed'),
    ]);
    await expect(
      openFrom({ ...asking(ALICE, 'user_2'), stationId: at('triage') }),
    ).resolves.toEqual([at('backlog'), at('triage'), at('completed')]);
  });
});
