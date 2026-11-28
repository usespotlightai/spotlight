import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatRuns } from '@work/application/services/chat-runs.service';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T09:00:00.000Z');

const CHAT = Chat.start({
  lines: [],
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  startedBy: UserId.of('user_1'),
  harness: HarnessId.of('claude-code'),
  model: HarnessModel.of('opus'),
  repositories: [Repository.of('acme/api')],
  body: ChatMessageBody.fromInput('Plan the retries.'),
  now: NOW,
  newId: () => 'chat_1',
});

const dispatched = (
  subject: Parameters<typeof Dispatch.ordered>[0]['subject'],
): DispatchRepository => ({
  add: async () => {},
  save: async () => {},
  find: async () =>
    Dispatch.ordered({
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      subject,
      configuredAs: null,
      order: runOrderOf(RunId.of('run_1')),
      now: NOW,
    }),
});

const chats = (chat: Chat | null): ChatRepository =>
  partial<ChatRepository>({ find: async () => chat });

const ASKED_BY_CHAT = WorkRequesters.chat(CHAT.id, TeamId.of('team_1'));

const ASKED_BY_TASK = WorkRequesters.task(
  TaskId.of('task_1'),
  TaskRevision.of(0),
  TeamId.of('team_1'),
);

const unread = (): never => {
  throw new Error('read');
};

describe('ChatRuns', () => {
  it('names the chat a run worked for, and what it chats with', async () => {
    const runs = new ChatRuns(
      dispatched({ kind: 'chat', chatId: CHAT.id }),
      chats(CHAT),
    );

    expect(await runs.of('run_1', ASKED_BY_CHAT)).toEqual({
      runId: 'run_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      chatId: 'chat_1',
      harness: 'claude-code',
      model: 'opus',
      repositories: ['acme/api'],
    });
  });

  it('names no chat for a task run, a run of a chat that is gone, or a run Work did not order', async () => {
    const task = new ChatRuns(
      dispatched({
        kind: 'task',
        taskId: TaskId.of('task_1'),
        revision: TaskRevision.of(0),
        stationId: StationId.of('station_1'),
        driver: 'line' as const,
      }),
      chats(CHAT),
    );
    const gone = new ChatRuns(
      dispatched({ kind: 'chat', chatId: CHAT.id }),
      chats(null),
    );
    const unordered = new ChatRuns(
      { add: async () => {}, save: async () => {}, find: async () => null },
      chats(CHAT),
    );

    expect(await task.of('run_1', ASKED_BY_CHAT)).toBeNull();
    expect(await gone.of('run_1', ASKED_BY_CHAT)).toBeNull();
    expect(await unordered.of('run_1', ASKED_BY_CHAT)).toBeNull();
  });

  it('names no chat for a run a task or another context asked for, without reading anything', async () => {
    const runs = new ChatRuns(
      { add: unread, save: unread, find: unread },
      partial<ChatRepository>({ find: unread }),
    );

    expect(await runs.of('run_1', ASKED_BY_TASK)).toBeNull();
    expect(
      await runs.of('run_1', {
        owner: 'assist',
        kind: 'chat',
        id: 'chat_1',
        token: null,
      }),
    ).toBeNull();
  });
});
