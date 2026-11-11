import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ChatMarkTakenError } from '@work/domain/exceptions/chat-mark-taken.error';
import { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { DrizzleChatMarks } from '@work/infrastructure/persistence/drizzle/readers/chat-marks.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { createTeam } from './support/team';

let database: TestDatabase;
let chats: DrizzleChatRepository;
let tasks: DrizzleTaskRepository;

beforeAll(async () => {
  database = await openDatabase('chat_marks');
  chats = new DrizzleChatRepository(new DrizzleContext(database.db), {
    dispatch: async () => {},
  });
  tasks = new DrizzleTaskRepository(new DrizzleContext(database.db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const WORKSPACE = WorkspaceId.of('ws_1');
const CHANNEL = Mark.of('slack.channel', 'C1');

const startedIn = (thread: Mark, workspaceId = WORKSPACE) =>
  Chat.start({
    lines: [],
    workspaceId,
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('dev'),
    body: ChatMessageBody.fromInput('Why do retries fail?'),
    marks: [ChatMark.finding(thread), ChatMark.ambient(CHANNEL)],
    now: new Date(),
    newId: () => randomUUID(),
  });

const keys = (...marks: Mark[]) =>
  CorrelationKeys.of({ marks }) as CorrelationKeys;

describe('chat marks, stored in the database (e2e)', () => {
  it('keeps the marks a chat was started with', async () => {
    const chat = startedIn(Mark.of('slack.thread', `C1:${randomUUID()}`));

    await chats.add(chat);

    expect((await chats.find(chat.id))?.marks).toEqual(chat.marks);
  });

  it('finds a chat by the mark that finds it, in its own workspace only', async () => {
    const thread = Mark.of('slack.thread', `C1:${randomUUID()}`);
    const chat = startedIn(thread);

    await chats.add(chat);

    expect(
      (await chats.findByCorrelation(WORKSPACE, keys(thread)))?.id,
    ).toEqual(chat.id);
    expect(
      await chats.findByCorrelation(WorkspaceId.of('ws_2'), keys(thread)),
    ).toBeNull();
  });

  it('reads only the ambient marks of a chat', async () => {
    const chat = startedIn(Mark.of('slack.thread', `C1:${randomUUID()}`));

    await chats.add(chat);

    expect(await new DrizzleChatMarks(database.db).ambientOf(chat.id)).toEqual([
      CHANNEL,
    ]);
  });

  it('lets only one chat have a finding mark', async () => {
    const thread = Mark.of('slack.thread', `C1:${randomUUID()}`);

    await chats.add(startedIn(thread));

    await expect(chats.add(startedIn(thread))).rejects.toThrow(
      ChatMarkTakenError,
    );
  });

  it('keeps the chat a task was proposed in', async () => {
    const { owner, stationId, line } = await createTeam(
      database.db,
      tasks,
      `chat-marks-${randomUUID()}`,
    );
    const chat = startedIn(
      Mark.of('slack.thread', `C1:${randomUUID()}`),
      line.workspaceId,
    );
    const proposedIn = ProposalOrigin.of({
      chatId: chat.id,
      position: MessagePosition.of(1),
    });
    const task = Task.add({
      line,
      at: stationId,
      title: TaskTitle.of('Back off exponentially'),
      rank: TaskRank.between(null, null),
      createdBy: owner,
      proposedIn,
      now: new Date(),
      newId: () => randomUUID(),
    });

    await chats.add(chat);
    await tasks.add(task);

    expect((await tasks.find(task.id))?.proposedIn).toEqual(proposedIn);
  });

  it('finds no chat by an ambient mark that many chats share', async () => {
    await chats.add(startedIn(Mark.of('slack.thread', `C1:${randomUUID()}`)));
    await chats.add(startedIn(Mark.of('slack.thread', `C1:${randomUUID()}`)));

    expect(await chats.findByCorrelation(WORKSPACE, keys(CHANNEL))).toBeNull();
  });
});
