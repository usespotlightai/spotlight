import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { EditorLeasesPort } from '@runners/application/ports/editor-leases.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  ConnectEditorCommand,
  type EditorTarget,
} from '@work/application/commands/connect-editor.command';
import { ConnectEditorHandler } from '@work/application/commands/handlers/connect-editor.handler';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-30T10:00:00.000Z');

const ADA = 'user_ada';
const BEA = 'user_bea';
const OUTSIDER = 'user_outsider';

const WORKSPACE = WorkspaceId.of('ws_1');

const TASK: EditorTarget = { kind: 'task', id: 'task_1' };
const CHAT: EditorTarget = { kind: 'chat', id: 'chat_1' };

const setUp = () => {
  const chat = Chat.start({
    workspaceId: WORKSPACE,
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of(ADA),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.fromInput('Plan the retries.'),
    now: NOW,
    newId: () => 'chat_1',
  });
  const access = {
    mayView: vi.fn(
      async (viewer: UserId, workspaceId: WorkspaceId) =>
        viewer.value !== OUTSIDER && workspaceId.equals(WORKSPACE),
    ),
    inWorkspace: vi.fn(async (slug: string, viewer: UserId) =>
      slug === 'acme' && viewer.value !== OUTSIDER
        ? { workspaceId: WORKSPACE, slug, viewer, isAdmin: false }
        : slug === 'other'
          ? {
              workspaceId: WorkspaceId.of('ws_2'),
              slug,
              viewer,
              isAdmin: false,
            }
          : null,
    ),
  } as unknown as WorkspaceAccessPort;
  const tasks = {
    workspaceOf: vi.fn(async (taskId: { value: string }) =>
      taskId.value === 'task_1' ? WORKSPACE : null,
    ),
  };
  const chats = {
    find: vi.fn(async (id: { value: string }) =>
      id.value === 'chat_1' ? chat : null,
    ),
  } as unknown as ChatRepository;
  const leases = {
    hold: vi.fn(async () => ({ sandboxId: 'sandbox_1', holder: 'conn_1' })),
  } satisfies EditorLeasesPort;
  const handler = new ConnectEditorHandler(tasks, chats, access, leases);

  return {
    leases,
    connect: (viewer: string, target: EditorTarget, slug: string | null) =>
      handler.execute(new ConnectEditorCommand(viewer, target, slug)),
  };
};

describe('ConnectEditorHandler', () => {
  it('holds the sandbox of a task’s workspace and resume key for a person who may view it', async () => {
    const { connect, leases } = setUp();

    expect(await connect(BEA, TASK, 'acme')).toEqual({
      sandboxId: 'sandbox_1',
      holder: 'conn_1',
    });
    expect(leases.hold).toHaveBeenCalledWith('ws_1', 'task-task_1');
  });

  it('holds the sandbox of a chat for the person who started it only', async () => {
    const { connect, leases } = setUp();

    expect(await connect(ADA, CHAT, null)).not.toBeNull();
    expect(leases.hold).toHaveBeenCalledWith('ws_1', 'chat-chat_1');
    expect(await connect(BEA, CHAT, null)).toBeNull();
    expect(leases.hold).toHaveBeenCalledTimes(1);
  });

  it('holds nothing for a person outside the workspace, an unknown task, or another workspace’s name', async () => {
    const { connect, leases } = setUp();

    expect(await connect(OUTSIDER, TASK, null)).toBeNull();
    expect(await connect(BEA, { kind: 'task', id: 'task_9' }, null)).toBeNull();
    expect(await connect(BEA, TASK, 'other')).toBeNull();
    expect(await connect(BEA, TASK, 'missing')).toBeNull();
    expect(leases.hold).not.toHaveBeenCalled();
  });
});
