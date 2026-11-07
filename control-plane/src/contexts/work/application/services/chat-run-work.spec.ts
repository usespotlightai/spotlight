import type { LeasedRunFacts } from '@runs/application/ports/run-leases.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatRunWork } from '@work/application/services/chat-run-work';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-07T09:00:00.000Z');

const chat = Chat.start({
  lines: [],
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  startedBy: UserId.of('user_1'),
  harness: HarnessId.of('claude-code'),
  repositories: [Repository.of('acme/api')],
  body: ChatMessageBody.fromInput('Plan how retries back off.'),
  now: NOW,
  newId: () => 'chat_1',
});

const work = new ChatRunWork(
  {} as LeasedRunFacts,
  chat,
  {} as unknown as ChatRepository,
);

const tool = (approval: ApprovalNeeded | null) =>
  DeclaredTool.of({
    tool: Tool.of('linear.comment'),
    description: 'Comment on the issue.',
    approval,
  });

describe('the work of a chat run', () => {
  it('uses a tool that needs no approval', async () => {
    expect((await work.clearFor(tool(null))).kind).toBe('approved');
  });

  it('refuses a tool a person has to approve, because a chat has nobody to put it to', async () => {
    expect(
      await work.clearFor(
        tool(ApprovalNeeded.of('linear.comment', 'It posts publicly.')),
      ),
    ).toEqual({
      kind: 'dismissed',
      reason:
        'linear.comment has to be approved by a person on a task, and a chat has nobody to put it to.',
    });
  });

  it('asks nobody to connect an integration', async () => {
    expect(
      await work.askToConnect(tool(null), {
        integration: 'linear',
        integrationName: 'Linear',
        personId: 'user_1',
        because: 'not-connected',
      }),
    ).toEqual({
      kind: 'denied',
      reason:
        'Linear acts as each person who starts a task, and a chat has no task to ask anyone to connect it on',
    });
  });

  it('dismisses a permission the harness asks for', async () => {
    expect(await work.clearPermission()).toBe('dismissed');
  });
});
