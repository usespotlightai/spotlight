import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import { SetupPullRequestToolUse } from '@work/application/services/setup-pull-request.tool-use';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { InvalidSetupBranchError } from '@work/domain/exceptions/invalid-setup-branch.error';
import { NotASetupChatError } from '@work/domain/exceptions/not-a-setup-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ConfigHome } from '@work/domain/value-objects/config-home.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-11T09:00:00.000Z');

const URL = 'https://github.com/acme/infra/pull/12';

const INPUTS = ToolInputs.of({
  branch: 'spotlight-configuration',
  title: 'Set up Spotlight as code',
  body: 'Triage reads the bug, feature and chore labels.',
});

const using = (given: { setup?: boolean } = {}) => {
  let chat = Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.of('Set up our configuration.'),
    setup:
      given.setup === false
        ? null
        : ConfigHome.of({ repository: 'acme/infra', folder: 'spotlight' }),
    now: NOW,
    newId: () => 'chat_1',
  }).handedTo(RunId.of('run_1'), NOW);
  chat.pullEvents();

  const events: unknown[] = [];
  const save = vi.fn(async (saved: Chat) => {
    events.push(...saved.pullEvents());
    chat = saved;
  });
  const open = vi.fn(async () => ({ url: URL }));
  const tool = new SetupPullRequestToolUse(
    { find: async () => chat, save } as unknown as ChatRepository,
    { open } as unknown as PullRequestPort,
    { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
    { now: () => NOW } as ClockPort,
  );
  const context: ChatToolContext = {
    kind: 'chat',
    runId: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    chatId: chat.id,
    teamId: TeamId.of('team_1'),
    requester: null,
  };

  return { tool, context, save, open, events, current: () => chat };
};

describe('SetupPullRequestToolUse', () => {
  it('is the setup-pull-request tool', () => {
    expect(using().tool.tool.value).toBe('setup-pull-request');
  });

  it('opens the pull request in the configuration’s repository, from the branch named', async () => {
    const { tool, context, open } = using();

    await expect(tool.call(context, INPUTS)).resolves.toEqual({ url: URL });
    expect(open).toHaveBeenCalledWith({
      workspaceId: WorkspaceId.of('ws_1'),
      repository: expect.objectContaining({ value: 'acme/infra' }),
      branch: 'spotlight-configuration',
      title: 'Set up Spotlight as code',
      body: 'Triage reads the bug, feature and chore labels.',
    });
  });

  it('keeps the pull request on the chat, and says it opened', async () => {
    const { tool, context, events, current } = using();

    await tool.call(context, INPUTS);

    expect(current().setup?.pullRequest?.value).toBe(URL);
    expect(events).toEqual([expect.any(SetupPullRequestOpened)]);
  });

  it('answers the pull request already opened rather than opening another', async () => {
    const { tool, context, open } = using();

    await tool.call(context, INPUTS);
    await expect(tool.call(context, INPUTS)).resolves.toEqual({ url: URL });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('refuses a chat that sets nothing up', async () => {
    const { tool, context, open } = using({ setup: false });

    await expect(tool.call(context, INPUTS)).rejects.toThrow(
      NotASetupChatError,
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses a branch named like a task’s', async () => {
    const { tool, context, open } = using();

    await expect(
      tool.call(
        context,
        ToolInputs.of({ branch: 'spotlight/configuration', title: 'Set up' }),
      ),
    ).rejects.toThrow(InvalidSetupBranchError);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens nothing for a run that no longer works the chat', async () => {
    const { tool, context, open } = using();

    await expect(
      tool.call({ ...context, runId: RunId.of('run_2') }, INPUTS),
    ).rejects.toThrow(InvalidChatTransitionError);
    expect(open).not.toHaveBeenCalled();
  });
});
