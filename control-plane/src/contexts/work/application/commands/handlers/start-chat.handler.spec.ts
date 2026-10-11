import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { RepositoryCatalogPort } from '@github/application/ports/repository-catalog.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { StartChatCommand } from '@work/application/commands/chat.commands';
import { StartChatHandler } from '@work/application/commands/handlers/start-chat.handler';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { FilesAtHand } from '@work/application/services/files-at-hand.service';
import type { TracesAtHand } from '@work/application/services/traces-at-hand.service';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { GitHubReachableRepositories } from '@work/infrastructure/github/github-reachable-repositories';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-11T09:00:00.000Z');

const starting = (listed: () => Promise<{ fullName: string }[]>) => {
  const added: Chat[] = [];
  const handler = new StartChatHandler(
    {
      findTeamForMember: vi.fn(async () => ({
        teamId: 'team_1',
        workspaceId: 'ws_1',
        slug: 'acme',
        teamKey: 'core',
      })),
    } as unknown as WorkspaceReaderPort,
    {
      add: vi.fn(async (chat: Chat) => {
        added.push(chat);
      }),
    } as unknown as ChatRepository,
    {
      handedOver: vi.fn(async () => []),
      takenIn: vi.fn(async () => undefined),
    } as unknown as FilesAtHand,
    { shared: vi.fn(async () => []) } as unknown as TracesAtHand,
    {} as LineRepository,
    {
      takenUp: vi.fn(async (chat: Chat) => chat),
    } as unknown as ChatDispatching,
    {
      catalogue: () => [{ id: 'claude-code' }],
    } as unknown as HarnessLaunchPort,
    new GitHubReachableRepositories({
      list: vi.fn(listed),
    } as unknown as RepositoryCatalogPort),
    { generate: () => 'chat_1' } as IdGeneratorPort,
    { now: () => NOW } as ClockPort,
    { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
  );

  return { handler, added };
};

const settingUp = (repository: string) =>
  new StartChatCommand(
    'team_1',
    'user_1',
    'claude-code',
    null,
    null,
    [],
    'Set up our configuration.',
    [],
    [],
    null,
    { repository, folder: 'spotlight' },
  );

describe('StartChatHandler', () => {
  it('starts a setup chat in a repository the GitHub App reaches', async () => {
    const { handler, added } = starting(async () => [
      { fullName: 'acme/infra' },
    ]);

    await expect(handler.execute(settingUp('acme/infra'))).resolves.toBe(
      'chat_1',
    );
    expect(added[0]?.setup?.repository.value).toBe('acme/infra');
  });

  it('refuses a setup chat in a repository the GitHub App does not reach', async () => {
    const { handler, added } = starting(async () => [
      { fullName: 'acme/infra' },
    ]);

    await expect(handler.execute(settingUp('acme/example'))).rejects.toThrow(
      "The GitHub App can't reach acme/example.",
    );
    expect(added).toEqual([]);
  });

  it('refuses a setup chat where the workspace has no GitHub App', async () => {
    const { handler } = starting(async () => {
      throw new NoGitHubInstallationError();
    });

    await expect(handler.execute(settingUp('acme/infra'))).rejects.toThrow(
      "The GitHub App can't reach acme/infra.",
    );
  });
});
