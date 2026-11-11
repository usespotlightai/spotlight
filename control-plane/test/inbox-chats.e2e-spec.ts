import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { PageRequest } from '@work/application/dto/page.dto';
import type {
  InboxChatSummary,
  InboxEntrySummary,
  InboxScope,
} from '@work/application/ports/inbox-reader.port';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

let database: TestDatabase;
let chats: DrizzleChatRepository;
let reader: DrizzleInboxReader;

beforeAll(async () => {
  database = await openDatabase('inbox_chats');
  const context = new DrizzleContext(database.db);

  chats = new DrizzleChatRepository(context, { dispatch: async () => {} });
  reader = new DrizzleInboxReader(
    database.db,
    { findMany: async () => new Map() } as never,
    new RunReadModel(new DrizzleRunFactsReader(context)),
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const WORKSPACE = randomUUID();
const START = new Date('2026-10-20T09:00:00.000Z');
const AFTER = new Date('2026-10-20T11:00:00.000Z');
const FIRST = MessagePosition.of(1);

const scopeOf = (viewer: string): InboxScope => ({
  workspaceId: WORKSPACE,
  viewer: UserId.of(viewer),
  teamsSeen: new Set(['team_1']),
  teamsActedOn: new Set(),
});

const startedBy = (viewer: string, extra: { marks?: ChatMark[] } = {}) =>
  Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of(WORKSPACE),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of(viewer),
    harness: HarnessId.of('dev'),
    body: ChatMessageBody.fromInput('Why do retries fail?'),
    marks: extra.marks,
    now: START,
    newId: () => randomUUID(),
  });

const repliedTo = (chat: Chat) => {
  const run = RunId.of(randomUUID());
  const working = chat.assignRun(run, START);

  return working.runEnded(run, {
    session: HarnessSession.of('session_1'),
    claimedBy: null,
  }).chat;
};

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

const ended = (chat: Chat) =>
  chat.runEnded(chat.currentRunId as RunId, {
    session: HarnessSession.of('session_1'),
    claimedBy: null,
  }).chat;

const chatEntry = (entries: readonly InboxEntrySummary[], chat: Chat) =>
  entries.find(
    (each): each is InboxChatSummary =>
      each.kind === 'chat' && each.id === chat.id.value,
  );

const open = async (viewer: string) => reader.open(scopeOf(viewer));

const resolvedPage = async (viewer: string, page: Partial<PageRequest>) =>
  reader.resolved(scopeOf(viewer), { before: null, limit: 20, ...page });

describe('agent chats in the inbox, read from the database (e2e)', () => {
  it('shows a chat with only the opening message as running', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = startedBy(viewer);
    await chats.add(chat);

    expect(chatEntry(await open(viewer), chat)).toMatchObject({
      section: 'running',
      progress: 'queued',
      resolved: false,
    });
  });

  it('shows a chat with a run in progress as running', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = startedBy(viewer).assignRun(RunId.of(randomUUID()), START);
    await chats.add(chat);

    expect(chatEntry(await open(viewer), chat)?.section).toBe('running');
  });

  it('shows a chat as open once its run ended with a plain reply', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = repliedTo(startedBy(viewer));
    await chats.add(chat);

    expect(chatEntry(await open(viewer), chat)).toMatchObject({
      section: 'open',
      progress: null,
      unread: false,
      resolved: false,
    });
  });

  it('shows a chat with an open proposal as open and unread, counting the proposals', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = ended(proposedBy(startedBy(viewer)));
    await chats.add(chat);

    expect(chatEntry(await open(viewer), chat)).toMatchObject({
      section: 'open',
      unread: true,
      openProposals: 1,
    });
  });

  it('moves a chat to running when the person follows up, and back to open when the run ends', async () => {
    const viewer = `user_${randomUUID()}`;
    const replied = repliedTo(startedBy(viewer));
    await chats.add(replied);
    const following = replied.addMessage({
      by: UserId.of(viewer),
      body: ChatMessageBody.of('And then?'),
      at: new Date('2026-10-20T10:00:00.000Z'),
    });
    await chats.save(following);

    expect(chatEntry(await open(viewer), following)?.section).toBe('running');

    const answered = (await chats.find(following.id)) as Chat;
    await chats.save(repliedTo(answered));

    expect(chatEntry(await open(viewer), following)?.section).toBe('open');
  });

  it('keeps a chat open when its proposal is dismissed', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = ended(proposedBy(startedBy(viewer))).dismiss(
      FIRST,
      UserId.of(viewer),
      START,
    );
    await chats.add(chat);

    expect(chatEntry(await open(viewer), chat)).toMatchObject({
      section: 'open',
      openProposals: 0,
    });
  });

  it('resolves a chat once its accepted proposal became a task', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = ended(proposedBy(startedBy(viewer)))
      .accept(FIRST, UserId.of(viewer), AFTER)
      .proposalBecame(FIRST, TaskId.of(randomUUID()), AFTER);
    await chats.add(chat);

    expect(chatEntry(await open(viewer), chat)).toBeUndefined();
    expect(
      chatEntry((await resolvedPage(viewer, {})).items, chat),
    ).toMatchObject({ section: 'resolved', resolved: true, reopenable: true });
  });

  it('moves a chat between open and resolved by hand, and marks it read', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = ended(proposedBy(startedBy(viewer)));
    await chats.add(chat);

    const read = (await chats.find(chat.id))?.markRead(
      UserId.of(viewer),
      AFTER,
    );
    await chats.save(read as Chat);
    expect(chatEntry(await open(viewer), chat)?.unread).toBe(false);

    const resolved = (await chats.find(chat.id))?.resolve(
      UserId.of(viewer),
      AFTER,
    );
    await chats.save(resolved as Chat);
    expect(chatEntry(await open(viewer), chat)).toBeUndefined();
    expect(
      chatEntry((await resolvedPage(viewer, {})).items, chat),
    ).toBeDefined();

    const reopened = (await chats.find(chat.id))?.reopen(UserId.of(viewer));
    await chats.save(reopened as Chat);
    expect(chatEntry(await open(viewer), chat)?.section).toBe('open');
    expect(
      chatEntry((await resolvedPage(viewer, {})).items, chat),
    ).toBeUndefined();
  });

  it('shows a resolved chat as running while a run works on it', async () => {
    const viewer = `user_${randomUUID()}`;
    const resolved = repliedTo(startedBy(viewer)).resolve(
      UserId.of(viewer),
      START,
    );
    await chats.add(resolved);
    const following = resolved
      .addMessage({
        by: UserId.of(viewer),
        body: ChatMessageBody.of('One more thing.'),
        at: new Date('2026-10-20T10:00:00.000Z'),
      })
      .assignRun(RunId.of(randomUUID()), START);
    await chats.save(following);

    expect(chatEntry(await open(viewer), following)?.section).toBe('running');
    expect(
      chatEntry((await resolvedPage(viewer, {})).items, following),
    ).toBeUndefined();
  });

  it('shows chats started from another channel', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = repliedTo(
      startedBy(viewer, {
        marks: [ChatMark.finding(Mark.of('slack.thread', randomUUID()))],
      }),
    );
    await chats.add(chat);

    expect(chatEntry(await open(viewer), chat)?.section).toBe('open');
  });

  it('shows nothing of a chat to anyone but the person who started it', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = repliedTo(startedBy(viewer));
    await chats.add(chat);

    expect(chatEntry(await open(`user_${randomUUID()}`), chat)).toBeUndefined();
  });

  it('shows nothing of a chat in a team the person does not see', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = repliedTo(startedBy(viewer));
    await chats.add(chat);

    expect(
      chatEntry(
        await reader.open({ ...scopeOf(viewer), teamsSeen: new Set() }),
        chat,
      ),
    ).toBeUndefined();
  });

  it('drops a chat that was deleted', async () => {
    const viewer = `user_${randomUUID()}`;
    const chat = repliedTo(startedBy(viewer));
    await chats.add(chat);
    await chats.remove((await chats.find(chat.id)) as Chat);

    expect(chatEntry(await open(viewer), chat)).toBeUndefined();
  });

  it('pages resolved chats newest first', async () => {
    const viewer = `user_${randomUUID()}`;
    const resolved = [0, 1, 2].map((minute) =>
      repliedTo(startedBy(viewer)).resolve(
        UserId.of(viewer),
        new Date(START.getTime() + (minute + 1) * 60_000),
      ),
    );
    for (const each of resolved) {
      await chats.add(each);
    }

    const first = await resolvedPage(viewer, { limit: 2 });
    const second = await resolvedPage(viewer, {
      limit: 2,
      before: first.next,
    });

    expect([...first.items, ...second.items].map((each) => each.id)).toEqual(
      resolved.map((each) => each.id.value).reverse(),
    );
    expect(second.next).toBeNull();
  });
});
