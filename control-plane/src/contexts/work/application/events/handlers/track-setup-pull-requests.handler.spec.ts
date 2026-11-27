import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TrackSetupPullRequests } from '@work/application/events/handlers/track-setup-pull-requests.handler';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = new Date('2026-11-11T10:00:00.000Z');
const MERGED_AT = new Date('2026-11-11T09:30:00.000Z');
const SETUP = PullRequestUrl.of('https://github.com/acme/infra/pull/12');

const settingUp = (id: string, pullRequest: PullRequestUrl) =>
  Chat.start({
    lines: [],
    workspaceId: WORKSPACE,
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    repositories: [Repository.of('acme/api')],
    body: ChatMessageBody.fromInput('Set up our configuration.'),
    setup: ConfigFolder.of({ repository: 'acme/infra', folder: 'spotlight' }),
    now: NOW,
    newId: () => id,
  })
    .assignRun(RunId.of(`run_${id}`), NOW)
    .openSetup(RunId.of(`run_${id}`), pullRequest, NOW);

const tracking = (stored: readonly Chat[]) => {
  const saved: Chat[] = [];
  const chats = partial<ChatRepository>({
    owningSetupPullRequest: async (
      _at: WorkspaceId,
      pullRequest: PullRequestUrl,
    ) =>
      stored.find((each) => each.setup?.pullRequest?.equals(pullRequest)) ??
      null,
    save: async (each: Chat) => {
      saved.push(each);
    },
  });

  return {
    saved,
    handler: new TrackSetupPullRequests(
      chats,
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => undefined },
    ),
  };
};

describe('TrackSetupPullRequests', () => {
  it('resolves the setup chat whose pull request merged', async () => {
    const { saved, handler } = tracking([settingUp('chat_1', SETUP)]);

    await handler.closed(WORKSPACE, SETUP, MERGED_AT, true);

    expect(saved.map((each) => [each.id.value, each.resolvedAt])).toEqual([
      ['chat_1', MERGED_AT],
    ]);
  });

  it('leaves the setup chats alone when another pull request merges', async () => {
    const { saved, handler } = tracking([settingUp('chat_1', SETUP)]);

    await handler.closed(
      WORKSPACE,
      PullRequestUrl.of('https://github.com/acme/infra/pull/13'),
      MERGED_AT,
      true,
    );

    expect(saved).toEqual([]);
  });

  it('keeps the setup chat open when its pull request closes unmerged', async () => {
    const { saved, handler } = tracking([settingUp('chat_1', SETUP)]);

    await handler.closed(WORKSPACE, SETUP, MERGED_AT, false);

    expect(saved).toEqual([]);
  });

  it('takes the time now when the close has none', async () => {
    const { saved, handler } = tracking([settingUp('chat_1', SETUP)]);

    await handler.closed(WORKSPACE, SETUP, null, true);

    expect(saved[0]?.resolvedAt).toEqual(NOW);
  });
});
