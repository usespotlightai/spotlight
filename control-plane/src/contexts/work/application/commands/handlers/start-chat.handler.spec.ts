import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { StartChatCommand } from '@work/application/commands/chat.commands';
import { StartChatHandler } from '@work/application/commands/handlers/start-chat.handler';
import type { AccessibleRepositoriesPort } from '@work/application/ports/accessible-repositories.port';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { TracesLoader } from '@work/application/services/traces-loader.service';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-11T09:00:00.000Z');

const starting = ({
  accessible = ['acme/infra'],
  hosted = true,
}: {
  accessible?: readonly string[];
  hosted?: boolean;
} = {}) => {
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
    } as unknown as FilesLoader,
    { shared: vi.fn(async () => []) } as unknown as TracesLoader,
    {} as LineRepository,
    {
      takenUp: vi.fn(async (chat: Chat) => chat),
    } as unknown as ChatDispatching,
    {
      catalogue: () => [{ id: 'claude-code' }],
    } as unknown as HarnessLaunchPort,
    {
      isAccessible: vi.fn(async (_, repository) =>
        accessible.includes(repository.value),
      ),
    } satisfies AccessibleRepositoriesPort,
    {
      hasEgressCapableRunner: vi.fn(async () => hosted),
    } as unknown as RunnerReaderPort,
    { generate: () => 'chat_1' } as IdGeneratorPort,
    { now: () => NOW } as ClockPort,
    {
      inTransaction: (work: () => Promise<unknown>) => work(),
    } as TransactionPort,
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
  it('starts a setup chat in a repository that the GitHub App can access', async () => {
    const { handler, added } = starting();

    await expect(handler.execute(settingUp('acme/infra'))).resolves.toBe(
      'chat_1',
    );
    expect(added[0]?.setup?.repository.value).toBe('acme/infra');
  });

  it('rejects a setup chat in a repository that the GitHub App cannot access', async () => {
    const { handler, added } = starting();

    await expect(handler.execute(settingUp('acme/example'))).rejects.toThrow(
      "The GitHub App can't access acme/example.",
    );
    expect(added).toEqual([]);
  });

  it('rejects a setup chat where no host or push pool with egress serves the workspace', async () => {
    const { handler, added } = starting({ hosted: false });

    await expect(handler.execute(settingUp('acme/infra'))).rejects.toThrow(
      'A setup chat needs egress',
    );
    expect(added).toEqual([]);
  });
});
