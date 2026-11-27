import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type { LeasedRunFacts } from '@runs/application/ports/run-leases.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatRunWork } from '@work/application/services/chat-run-work';
import { defaultBranchIs } from '@work/application/services/run-works.fake-spec';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { RefUpdate } from '@work/domain/value-objects/ref-update.vo';
import { describe, expect, it, vi } from 'vitest';

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

const onBranch = vi.fn(() => Promise.resolve(null));

const work = new ChatRunWork(
  partial<LeasedRunFacts>({}),
  chat,
  partial<ChatRepository>({}),
  partial<TaskRepository>({ onBranch }),
  defaultBranchIs('main'),
);

const pushed = (ref: string) =>
  RefUpdate.of({ ref, from: 'a'.repeat(40), to: 'c'.repeat(40) });

const tool = (approval: ApprovalNeeded | null) =>
  DeclaredTool.of({
    readOnly: false,
    tool: Tool.of('linear.comment'),
    description: 'Comment on the issue.',
    approval,
  });

describe('the work of a chat run', () => {
  it('lets a chat push a branch no task owns', async () => {
    await expect(
      work.pushRefusal(Repository.of('acme/api'), [
        pushed('refs/heads/fix/retries'),
      ]),
    ).resolves.toBeNull();
    expect(onBranch).toHaveBeenCalledOnce();
  });

  it('lets the probe before a large push through without asking GitHub', async () => {
    const asked = vi.fn(() => Promise.resolve('main'));
    const probing = new ChatRunWork(
      partial<LeasedRunFacts>({}),
      chat,
      partial<ChatRepository>({}),
      partial<TaskRepository>({ onBranch }),
      partial<RepositorySettingsPort>({ defaultBranchNameOf: asked }),
    );

    await expect(
      probing.pushRefusal(Repository.of('acme/api'), []),
    ).resolves.toBeNull();
    expect(asked).not.toHaveBeenCalled();
  });

  it('refuses a push it cannot check while GitHub does not answer', async () => {
    const offline = new ChatRunWork(
      partial<LeasedRunFacts>({}),
      chat,
      partial<ChatRepository>({}),
      partial<TaskRepository>({ onBranch }),
      partial<RepositorySettingsPort>({
        defaultBranchNameOf: () => {
          return Promise.reject(new Error('rate limited'));
        },
      }),
    );

    await expect(
      offline.pushRefusal(Repository.of('acme/api'), [
        pushed('refs/heads/fix/retries'),
      ]),
    ).resolves.toBe(
      'Spotlight could not read the default branch of acme/api from GitHub, so it cannot check this push. Push again in a minute.',
    );
  });

  it('refuses a push that also updates the default branch, and says why', async () => {
    await expect(
      work.pushRefusal(Repository.of('acme/api'), [
        pushed('refs/heads/fix/retries'),
        pushed('refs/heads/main'),
      ]),
    ).resolves.toBe(
      'main is the default branch. Push the change to a new branch and open a pull request.',
    );
  });

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
