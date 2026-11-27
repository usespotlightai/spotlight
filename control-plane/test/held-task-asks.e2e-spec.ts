import { randomUUID } from 'node:crypto';

import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  InboxEntrySummary,
  InboxItemSummary,
  InboxScope,
} from '@work/application/ports/inbox-reader.port';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

const NOW = new Date('2026-11-20T09:00:00.000Z');
const LINEAR = IntegrationName.of('linear');

let database: TestDatabase;
let tasks: DrizzleTaskRepository;
let reader: DrizzleInboxReader;
let line: LineMap;
let teamId: string;
let workspaceId: string;
let holder: UserId;
const asked = UserId.of(`user_${randomUUID()}`);
const bystander = UserId.of(`user_${randomUUID()}`);

beforeAll(async () => {
  database = await openDatabase('held_task_asks');
  const context = new DrizzleContext(database.db);

  tasks = new DrizzleTaskRepository(context, { dispatch: async () => {} });
  reader = new DrizzleInboxReader(
    database.db,
    partial<PersonReaderPort>({ findMany: async () => new Map() }),
    new RunReadModel(new DrizzleRunFactsReader(context)),
  );

  const team = await createTeam(
    database.db,
    tasks,
    `held-${randomUUID().slice(0, 8)}`,
  );
  holder = team.owner;
  teamId = team.teamId.value;
  workspaceId = team.workspaceId.value;
  line = deliveryLineOf({
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    harness: HarnessId.of('dev'),
    newId: () => randomUUID(),
  });

  await database.db.insert(schema.line).values({
    id: line.id.value,
    workspaceId,
    teamId,
    key: line.key.value,
    name: line.name.value,
  });
  await insertStations(
    database.db,
    line.stations.map((each) => ({
      id: each.id.value,
      workspaceId,
      lineId: line.id.value,
      key: each.key.value,
      name: each.name.value,
      position: each.position,
      kind: each.kind,
    })),
  );
}, 60_000);

afterAll(async () => {
  await database.close();
});

const scopeOf = (viewer: UserId, actsOnTeam = true): InboxScope => ({
  workspaceId,
  viewer,
  teamsSeen: new Set([teamId]),
  teamsActedOn: new Set(actsOnTeam ? [teamId] : []),
  teamsJoined: new Set(actsOnTeam ? [teamId] : []),
});

const heldAndAsking = async (): Promise<Task> => {
  const implementation = line.stationKeyed(StationKey.of('implementation'));

  if (!implementation) {
    throw new Error('the delivery line has no implementation station');
  }

  const turn = RunId.of(randomUUID());
  const task = Task.add({
    line,
    at: implementation.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    createdBy: holder,
    now: NOW,
    newId: () => randomUUID(),
  })
    .assignRun(RunId.of(randomUUID()), line)
    .heldOnMessage(
      null,
      {
        id: HoldId.of(randomUUID()),
        members: TeamMembers.of([holder, asked]),
        line,
        currentRunStarted: true,
        at: NOW,
      },
      {
        line,
        body: TaskNoteBody.of('Use a bounded queue.'),
        at: NOW,
        voice: Voice.person(holder),
      },
      implementation.id,
      onTeam(holder),
    )
    .assignRun(turn, line)
    .askToConnect(
      turn,
      {
        line,
        body: TaskNoteBody.of('Connect Linear.'),
        at: NOW,
        voice: Voice.station(turn),
      },
      ConnectionAsk.of({
        teamId: line.teamId,
        integration: LINEAR,
        providedBy: 'Linear',
        personId: asked,
      }),
    ).task;

  await tasks.add(task);

  return task;
};

const conversationIn = (entries: readonly InboxEntrySummary[], task: Task) =>
  entries.find(
    (each): each is InboxItemSummary =>
      each.kind === 'task' && each.taskId === task.id.value,
  );

const MEMBERS = () => TeamMembers.of([holder, asked]);
const onTeam = (person: UserId) => ({
  person,
  team: TeamStanding.of({
    seesTeam: true,
    actsOnTeam: true,
    memberOfTeam: true,
  }),
});

const added = (): Task => {
  const implementation = line.stationKeyed(StationKey.of('implementation'));

  if (!implementation) {
    throw new Error('the delivery line has no implementation station');
  }

  return Task.add({
    line,
    at: implementation.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    createdBy: holder,
    now: NOW,
    newId: () => randomUUID(),
  });
};

const said = (body: string, voice: Voice) => ({
  line,
  body: TaskNoteBody.of(body),
  at: NOW,
  voice,
});

const askingApproval = (task: Task, turn: RunId, of: UserId): Task =>
  task.clearFor(
    ApprovalSubject.toolCall(
      ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
    ),
    ApprovalNeeded.of('linear.comment', 'It posts publicly.', of),
    said('Approve linear.comment?', Voice.station(turn)),
    turn,
    null,
  ).task;

const entryWithId = (
  entries: readonly InboxEntrySummary[],
  id: string,
): InboxItemSummary | undefined =>
  entries.find(
    (each): each is InboxItemSummary => each.kind === 'task' && each.id === id,
  );

const standingIn = (
  entries: readonly InboxEntrySummary[],
  task: Task,
): string | null | undefined => conversationIn(entries, task)?.standing;

describe('a held task whose turn asks another person (e2e)', () => {
  it('lists the ask for the person it names, and keeps the task with its holder', async () => {
    const task = await heldAndAsking();

    expect(standingIn(await reader.open(scopeOf(asked)), task)).toBe('asked');
    expect(standingIn(await reader.open(scopeOf(holder)), task)).toBe(
      'assignee',
    );
  });

  it('lets the holder and every person who acts on the team resolve the ask, and nobody who only sees the team', async () => {
    const task = await heldAndAsking();

    expect(
      conversationIn(await reader.open(scopeOf(holder)), task)?.resolvable,
    ).toBe(true);
    expect(
      conversationIn(await reader.open(scopeOf(asked)), task)?.resolvable,
    ).toBe(true);
    expect(
      conversationIn(await reader.open(scopeOf(asked, false)), task)
        ?.resolvable,
    ).toBe(false);
    expect(
      conversationIn(await reader.open(scopeOf(holder, false)), task)
        ?.resolvable,
    ).toBe(false);
  });

  it('lets the holder reopen the ask once resolved, only while they act on the team', async () => {
    const task = await heldAndAsking();
    const from = task.openConversation?.from;

    if (!from) {
      throw new Error('the ask opened no conversation');
    }

    await tasks.save(
      task.resolveAs(onTeam(holder), from, {
        line,
        body: TaskNoteBody.of('Resolved without an answer.'),
        at: NOW,
        voice: Voice.person(holder),
      }),
    );

    const resolvedFor = async (actsOnTeam: boolean) =>
      conversationIn(
        (
          await reader.resolved(scopeOf(holder, actsOnTeam), {
            before: null,
            limit: 50,
          })
        ).items,
        task,
      );

    expect((await resolvedFor(true))?.reopenable).toBe(true);
    expect((await resolvedFor(false))?.reopenable).toBe(false);
  });

  it('lists the ask for an admin off the team who drove the hold, who may answer and resolve it, and nothing for one who did not write', async () => {
    const implementation = line.stationKeyed(StationKey.of('implementation'));

    if (!implementation) {
      throw new Error('the delivery line has no implementation station');
    }

    const admin = UserId.of(`user_${randomUUID()}`);
    const silent = UserId.of(`user_${randomUUID()}`);
    const offTeam = (person: UserId) => ({
      person,
      team: TeamStanding.of({
        seesTeam: true,
        actsOnTeam: true,
        memberOfTeam: false,
      }),
    });
    const held = RunId.of(randomUUID());
    const turn = RunId.of(randomUUID());
    const task = added()
      .assignRun(held, line)
      .heldOnMessage(
        held,
        {
          id: HoldId.of(randomUUID()),
          members: MEMBERS(),
          line,
          currentRunStarted: true,
          at: NOW,
        },
        said('Use a bounded queue.', Voice.person(holder)),
        implementation.id,
        onTeam(holder),
      )
      .receiveMessage(
        held,
        said('Cap it at a hundred.', Voice.person(admin)),
        implementation.id,
        offTeam(admin),
      )
      .assignRun(turn, line)
      .askToConnect(
        turn,
        said('Connect Linear.', Voice.station(turn)),
        ConnectionAsk.of({
          teamId: line.teamId,
          integration: LINEAR,
          providedBy: 'Linear',
          personId: asked,
        }),
      ).task;
    await tasks.add(task);
    const adminScope = (viewer: UserId): InboxScope => ({
      ...scopeOf(viewer),
      teamsJoined: new Set(),
    });

    expect(
      conversationIn(await reader.open(adminScope(admin)), task),
    ).toMatchObject({
      standing: 'following',
      answerable: true,
      resolvable: true,
    });
    expect(
      conversationIn(await reader.open(adminScope(silent)), task),
    ).toBeUndefined();
  });

  it('lists nothing for a team member the ask does not name', async () => {
    const task = await heldAndAsking();

    expect(
      standingIn(await reader.open(scopeOf(bystander)), task),
    ).toBeUndefined();
  });

  it('stops listing the ask once the person connects', async () => {
    const task = await heldAndAsking();
    const connected = task.connectionMade(line.teamId, LINEAR, asked, {
      line,
      at: NOW,
    });

    if (!connected) {
      throw new Error('the connection did not answer the ask');
    }

    await tasks.save(connected);

    expect(standingIn(await reader.open(scopeOf(asked)), task)).not.toBe(
      'asked',
    );
  });

  it('stops listing an ask whose conversation closed, once the turn asks something new', async () => {
    const task = await heldAndAsking();
    const turn = task.currentRunId;

    if (!turn) {
      throw new Error('the task has no current run');
    }

    const asksAgain = task
      .closeConversation({
        line,
        body: TaskNoteBody.of('Going on without Linear.'),
        at: NOW,
        voice: Voice.station(turn),
      })
      .askedAbout(
        {
          line,
          body: TaskNoteBody.of('Which queue should I drain?'),
          at: NOW,
          voice: Voice.station(turn),
        },
        turn,
      );

    await tasks.save(asksAgain);

    expect(standingIn(await reader.open(scopeOf(asked)), task)).toBeUndefined();
    expect(standingIn(await reader.open(scopeOf(holder)), task)).toBe(
      'assignee',
    );
  });

  it('lets a member of the team answer and resolve a task with no assignee, and leaves it out of the inbox of a person who only sees the team', async () => {
    const turn = RunId.of(randomUUID());
    const task = added()
      .assignRun(turn, line)
      .askedAbout(said('Which queue?', Voice.station(turn)), turn)
      .unassign();

    await tasks.add(task);

    const entry = conversationIn(await reader.open(scopeOf(holder)), task);
    const seenOnly = conversationIn(
      await reader.open(scopeOf(holder, false)),
      task,
    );

    expect(entry).toMatchObject({
      standing: 'team',
      answerable: true,
      resolvable: true,
    });
    expect(seenOnly).toBeUndefined();
  });

  it('keeps an ask with the person it names after the task moves to someone else, when it is not on hold', async () => {
    const turn = RunId.of(randomUUID());
    const asking = askingApproval(added().assignRun(turn, line), turn, asked);
    const moved = asking.assign(holder, MEMBERS());

    await tasks.add(moved);

    expect(asking.assignee).toEqual(asked);
    expect(
      conversationIn(await reader.open(scopeOf(asked)), moved),
    ).toMatchObject({ standing: 'asked', answerable: true, resolvable: false });
  });

  it('lets the person asked resolve the ask once nobody is assigned, as any member of the team may', async () => {
    const turn = RunId.of(randomUUID());
    const unassigned = askingApproval(
      added().assignRun(turn, line),
      turn,
      asked,
    ).unassign();

    await tasks.add(unassigned);

    expect(
      conversationIn(await reader.open(scopeOf(asked)), unassigned),
    ).toMatchObject({ standing: 'team', answerable: true, resolvable: true });
  });

  it('lists a new approval in a conversation already answered in words for the person it names', async () => {
    const turn = RunId.of(randomUUID());
    const working = added().assignRun(RunId.of(randomUUID()), line);
    const question = working
      .heldOnMessage(
        null,
        {
          id: HoldId.of(randomUUID()),
          members: MEMBERS(),
          line,
          currentRunStarted: true,
          at: NOW,
        },
        said('Use a bounded queue.', Voice.person(holder)),
        working.stationId,
        onTeam(holder),
      )
      .assignRun(turn, line)
      .putToAPerson(turn, said('Which queue?', Voice.station(turn)));
    const answered = question.answerAs(
      onTeam(holder),
      question.openConversation?.from ?? NotePosition.of(0),
      said('The main one.', Voice.person(holder)),
    );
    const task = askingApproval(answered, turn, asked);

    await tasks.add(task);

    expect(
      conversationIn(await reader.open(scopeOf(asked)), task),
    ).toMatchObject({ standing: 'asked', answerable: true, resolvable: true });
  });

  it('asks nobody again when a person reopens a conversation whose approval is decided, leaving it to the people who drive the task', async () => {
    const turn = RunId.of(randomUUID());
    const working = added().assignRun(RunId.of(randomUUID()), line);
    const asking = askingApproval(
      working
        .heldOnMessage(
          null,
          {
            id: HoldId.of(randomUUID()),
            members: MEMBERS(),
            line,
            currentRunStarted: true,
            at: NOW,
          },
          said('Use a bounded queue.', Voice.person(holder)),
          working.stationId,
          onTeam(holder),
        )
        .assignRun(turn, line),
      turn,
      asked,
    );
    const from = asking.openConversation?.from;

    if (!from) {
      throw new Error('the ask opened no conversation');
    }

    const reopened = asking
      .answerAs(
        onTeam(asked),
        from,
        said('Go ahead.', Voice.person(asked)),
        'approved',
      )
      .resolveAs(
        onTeam(holder),
        from,
        said('Resolved without an answer.', Voice.person(holder)),
      )
      .reopenAs(onTeam(holder), from, said('Reopened.', Voice.person(holder)));

    await tasks.add(reopened);

    expect(
      conversationIn(await reader.open(scopeOf(asked)), reopened),
    ).toMatchObject({ standing: 'following', answerable: true });
    expect(
      conversationIn(await reader.open(scopeOf(asked, false)), reopened),
    ).toMatchObject({ standing: 'following', answerable: false });
  });

  it('lets only a person who acts on the team resolve or reopen an inbox request', async () => {
    const task = await heldAndAsking();
    const open = randomUUID();
    const resolved = randomUUID();

    await database.db.insert(schema.inboxRequest).values([
      {
        id: open,
        workspaceId,
        taskId: task.id.value,
        form: 'memories',
        about: open,
        createdAt: NOW,
        openedAt: NOW,
        resolvedAt: null,
      },
      {
        id: resolved,
        workspaceId,
        taskId: task.id.value,
        form: 'memories',
        about: resolved,
        createdAt: NOW,
        openedAt: NOW,
        resolvedAt: NOW,
      },
    ]);

    const resolvedFor = async (actsOnTeam: boolean) =>
      entryWithId(
        (
          await reader.resolved(scopeOf(holder, actsOnTeam), {
            before: null,
            limit: 50,
          })
        ).items,
        resolved,
      );

    expect(entryWithId(await reader.open(scopeOf(holder)), open)).toMatchObject(
      { answerable: false, resolvable: true },
    );
    expect(
      entryWithId(await reader.open(scopeOf(holder, false)), open),
    ).toMatchObject({ resolvable: false });
    expect((await resolvedFor(true))?.reopenable).toBe(true);
    expect((await resolvedFor(false))?.reopenable).toBe(false);
  });

  it('lets only a person who acts on the team resolve or reopen a notice', async () => {
    const open = randomUUID();
    const resolved = randomUUID();
    const row = (id: string, resolvedAt: Date | null) => ({
      id,
      workspaceId,
      teamId,
      addresseeId: null,
      form: 'ended' as const,
      subject: id,
      link: 'lines',
      linkLabel: 'Open the lines',
      headline: 'The search stalled',
      points: ['Fix the claims.'],
      createdAt: NOW,
      resolvedAt,
    });
    const noticeIn = (
      entries: readonly InboxEntrySummary[],
      id: string,
    ): InboxEntrySummary | undefined =>
      entries.find((each) => each.kind === 'notice' && each.id === id);
    const resolvedFor = async (actsOnTeam: boolean) =>
      noticeIn(
        (
          await reader.resolved(scopeOf(holder, actsOnTeam), {
            before: null,
            limit: 50,
          })
        ).items,
        resolved,
      );

    await database.db
      .insert(schema.notice)
      .values([row(open, null), row(resolved, NOW)]);

    expect(noticeIn(await reader.open(scopeOf(holder)), open)).toMatchObject({
      resolvable: true,
    });
    expect(
      noticeIn(await reader.open(scopeOf(holder, false)), open),
    ).toMatchObject({ resolvable: false });
    expect(await resolvedFor(true)).toMatchObject({ reopenable: true });
    expect(await resolvedFor(false)).toMatchObject({ reopenable: false });
  });
});
