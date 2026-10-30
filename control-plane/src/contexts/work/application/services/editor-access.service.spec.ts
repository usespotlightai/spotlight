import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { EditorAccess } from '@work/application/services/editor-access.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-30T10:00:00.000Z');

const ADA = 'user_ada';
const BEA = 'user_bea';
const OUTSIDER = 'user_outsider';

const WORKSPACE = WorkspaceId.of('ws_1');

const editorAccess = () => {
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

  return new EditorAccess(tasks, chats, access);
};

describe('EditorAccess', () => {
  it('names the workspace and resume key of a task for a person who may view it', async () => {
    expect(
      await editorAccess().editorAccessFor(
        BEA,
        { kind: 'task', id: 'task_1' },
        'acme',
      ),
    ).toEqual({ workspaceId: 'ws_1', key: 'task-task_1' });
  });

  it('names the workspace and resume key of a chat for the person who started it only', async () => {
    const access = editorAccess();

    expect(
      await access.editorAccessFor(ADA, { kind: 'chat', id: 'chat_1' }, null),
    ).toEqual({ workspaceId: 'ws_1', key: 'chat-chat_1' });
    expect(
      await access.editorAccessFor(BEA, { kind: 'chat', id: 'chat_1' }, null),
    ).toBeNull();
  });

  it('refuses a person outside the workspace, an unknown task, and another workspace’s name', async () => {
    const access = editorAccess();
    const task = { kind: 'task', id: 'task_1' } as const;

    expect(await access.editorAccessFor(OUTSIDER, task, null)).toBeNull();
    expect(
      await access.editorAccessFor(BEA, { kind: 'task', id: 'task_9' }, null),
    ).toBeNull();
    expect(await access.editorAccessFor(BEA, task, 'other')).toBeNull();
    expect(await access.editorAccessFor(BEA, task, 'missing')).toBeNull();
  });
});
