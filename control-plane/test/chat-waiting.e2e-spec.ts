import { randomUUID } from 'node:crypto';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

let database: TestDatabase;
let chats: DrizzleChatRepository;
let reader: DrizzleChatReader;

beforeAll(async () => {
  database = await openDatabase('chat_waiting');
  const context = new DrizzleContext(database.db);

  chats = new DrizzleChatRepository(context, { dispatch: async () => {} });
  reader = new DrizzleChatReader(
    database.db,
    { find: async () => null } as never,
    { progressOf: async () => [] } as never,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const WORKSPACE = randomUUID();
const TEAM = TeamId.of('team_1');
const START = new Date('2026-10-20T09:00:00.000Z');

const startedBy = (viewer: string) =>
  Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of(WORKSPACE),
    teamId: TEAM,
    startedBy: UserId.of(viewer),
    harness: HarnessId.of('dev'),
    body: ChatMessageBody.fromInput('Why do retries fail?'),
    now: START,
    newId: () => randomUUID(),
  });

const ended = (chat: Chat) =>
  chat.runEnded(chat.currentRunId as RunId, {
    session: HarnessSession.of('session_1'),
    claimedBy: null,
  }).chat;

const repliedTo = (chat: Chat) =>
  ended(chat.assignRun(RunId.of(randomUUID()), START));

const proposedBy = (chat: Chat) => {
  const run = RunId.of(randomUUID());

  return chat.assignRun(run, START).propose({
    runId: run,
    placement: ProposalPlacement.of({
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    }),
    title: TaskTitle.of('Back off exponentially'),
    description: null,
    at: new Date('2026-10-20T09:05:00.000Z'),
  });
};

const waitingOf = async (viewer: string, chat: Chat) => {
  const page = await reader.startedBy(TEAM, UserId.of(viewer), {
    before: null,
    limit: 20,
  });

  return page.items.find((each) => each.id === chat.id.value)?.waitingForYou;
};

describe('agent chat summaries tell whether the chat waits for the person (e2e)', () => {
  it('waits when the agent replied and nobody resolved the chat', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = repliedTo(startedBy(viewer));
    await chats.add(chat);

    expect(await waitingOf(viewer, chat)).toBe(true);
  });

  it('waits when a proposal is unread, even while a run works', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = proposedBy(startedBy(viewer));
    await chats.add(chat);

    expect(await waitingOf(viewer, chat)).toBe(true);
  });

  it('does not wait while a run works and nothing is unread', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = startedBy(viewer).assignRun(RunId.of(randomUUID()), START);
    await chats.add(chat);

    expect(await waitingOf(viewer, chat)).toBe(false);
  });

  it('does not wait while the opening message has no answer yet', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = startedBy(viewer);
    await chats.add(chat);

    expect(await waitingOf(viewer, chat)).toBe(false);
  });

  it('does not wait once the chat is resolved', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = repliedTo(startedBy(viewer)).resolve(UserId.of(viewer), START);
    await chats.add(chat);

    expect(await waitingOf(viewer, chat)).toBe(false);
  });

  it('gives the same flag when one chat is read', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = repliedTo(startedBy(viewer));
    await chats.add(chat);

    expect((await reader.read(TEAM, chat.id))?.waitingForYou).toBe(true);
  });
});
