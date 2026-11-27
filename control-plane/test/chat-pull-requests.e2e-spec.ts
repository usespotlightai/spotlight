import { randomUUID } from 'node:crypto';

import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { present } from '@shared-kernel/domain/present.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatPullRequest } from '@work/domain/value-objects/chat-pull-request.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

let database: TestDatabase;
let chats: DrizzleChatRepository;
let tasks: DrizzleTaskRepository;
let reader: DrizzleChatReader;

beforeAll(async () => {
  database = await openDatabase('chat_pull_requests');
  const context = new DrizzleContext(database.db);

  chats = new DrizzleChatRepository(context, { dispatch: async () => {} });
  tasks = new DrizzleTaskRepository(context, { dispatch: async () => {} });
  reader = new DrizzleChatReader(
    database.db,
    partial<PersonReaderPort>({ find: () => Promise.resolve(null) }),
    { progressOf: () => Promise.resolve([]) },
  );
}, 60_000);

afterAll(async () => {
  await database.close();
});

const NOW = new Date('2026-11-19T09:00:00.000Z');
const WEB = Repository.of('acme/web');

const seated = async () => {
  const team = await createTeam(
    database.db,
    tasks,
    `chat-pull-requests-${randomUUID()}`,
  );
  const shipId = randomUUID();

  await insertStations(database.db, {
    id: shipId,
    workspaceId: team.workspaceId.value,
    lineId: team.line.id.value,
    key: 'ship',
    name: 'Ship',
    position: 2,
    harness: 'dev',
  });

  const line = lineMapOf({
    id: team.line.id,
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    key: team.line.key,
    name: team.line.name,
    stations: [
      ...team.line.stations.filter((each) => each.kind === 'backlog'),
      stationOf({
        id: StationId.of(shipId),
        key: StationKey.of('ship'),
        name: StationName.of('Ship'),
        position: 1,
        color: '#a3a8b0',
        harness: HarnessId.of('dev'),
        tools: [Tool.of('pull-request')],
      }),
      ...team.line.stations.filter((each) => each.kind === 'completed'),
    ],
  });

  return { ...team, line, shipId: StationId.of(shipId) };
};

const chatFor = (
  team: Awaited<ReturnType<typeof seated>>,
  run: RunId,
  pullRequest: ChatPullRequest,
) =>
  Chat.start({
    lines: [],
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    startedBy: team.owner,
    harness: HarnessId.of('dev'),
    repositories: [WEB],
    body: ChatMessageBody.fromInput('Show icons for videos.'),
    now: NOW,
    newId: () => randomUUID(),
  })
    .assignRun(run, NOW)
    .openedPullRequest({
      runId: run,
      title: 'Show video icons',
      repository: WEB,
      pullRequest,
      at: NOW,
    });

const pullRequestOf = async (
  team: Awaited<ReturnType<typeof seated>>,
  chat: Chat,
) =>
  (await reader.read(team.teamId, chat.id))?.messages.find(
    (each) => each.kind === 'opened',
  )?.pullRequest;

describe('pull requests an agent chat opened, stored in the database (e2e)', () => {
  it('keeps the task on hold for the chat, and reads it as held, then with the line once handed over', async () => {
    const team = await seated();
    const run = RunId.of(randomUUID());
    const url = PullRequestUrl.of('https://github.com/acme/web/pull/7');
    const chatId = randomUUID();
    const start = Chat.start({
      lines: [],
      workspaceId: team.workspaceId,
      teamId: team.teamId,
      startedBy: team.owner,
      harness: HarnessId.of('dev'),
      repositories: [WEB],
      body: ChatMessageBody.fromInput('Show icons for videos.'),
      now: NOW,
      newId: () => chatId,
    }).assignRun(run, NOW);
    const task = Task.openedInChat({
      defaultBranch: Branch.of('main'),
      line: team.line,
      at: team.shipId,
      title: TaskTitle.of('Show video icons'),
      description: null,
      branch: Branch.of('fix/video-icons'),
      rank: TaskRank.between(null, null),
      by: team.owner,
      members: TeamMembers.of([team.owner]),
      chat: start.id,
      hold: HoldId.of(randomUUID()),
      now: NOW,
      newId: () => randomUUID(),
    }).recordChatPullRequest(start.id, url, NOW, team.line);
    const chat = start.openedPullRequest({
      runId: run,
      title: 'Show video icons',
      repository: WEB,
      pullRequest: ChatPullRequest.of({ task: task.id, url }),
      at: NOW,
    });

    await tasks.add(task);
    await chats.add(chat);

    const stored = await tasks.find(task.id);

    expect(stored?.openHold?.chat?.equals(chat.id)).toBe(true);
    expect(
      (
        await tasks.onBranch(team.workspaceId, Branch.of('fix/video-icons'))
      )?.id.equals(task.id),
    ).toBe(true);
    expect(
      (await chats.find(chat.id))?.pullRequests.map((each) => each.task.value),
    ).toEqual([task.id.value]);
    expect(await pullRequestOf(team, chat)).toMatchObject({
      taskId: task.id.value,
      url: url.value,
      state: 'held',
      stationName: 'Ship',
    });

    await tasks.save(
      present(stored).resumeLine({
        by: team.owner,
        line: team.line,
        next: 'continue',
        to: null,
        rank: null,
        verdict: 'exploring',
        summary: null,
        turnHeads: [],
        at: new Date('2026-11-19T10:00:00.000Z'),
      }),
    );

    expect((await pullRequestOf(team, chat))?.state).toBe('line');
  });

  it('reads a pull request whose task was deleted as gone', async () => {
    const team = await seated();
    const run = RunId.of(randomUUID());
    const chat = chatFor(
      team,
      run,
      ChatPullRequest.of({
        task: TaskId.of(randomUUID()),
        url: PullRequestUrl.of('https://github.com/acme/web/pull/8'),
      }),
    );

    await chats.add(chat);

    expect((await pullRequestOf(team, chat))?.state).toBe('gone');
  });
});
