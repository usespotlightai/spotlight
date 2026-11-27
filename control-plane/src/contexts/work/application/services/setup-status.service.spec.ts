import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReadinessPort } from '@runners/application/ports/runner-readiness.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ChatReaderPort,
  SetupChatView,
} from '@work/application/ports/chat-reader.port';
import { SetupStatus } from '@work/application/services/setup-status.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('123e4567-e89b-42d3-a456-426614174001');

const TEAM = TeamId.of('team_1');

type Options = {
  connected?: boolean;
  harness?: boolean;
  hosted?: boolean;
  platform?: boolean;
  chats?: readonly SetupChatView[];
};

const read = (options: Options = {}) => {
  const connections = partial<WorkspaceConnectionsPort>({
    isConnected: vi.fn().mockResolvedValue(options.connected ?? false),
  });

  const runners = partial<RunnerReadinessPort>({
    readyToRun: vi.fn().mockResolvedValue(options.harness ?? false),
    hasEgressCapableRunner: vi.fn().mockResolvedValue(options.hosted ?? false),
    hasPlatformRunners: vi.fn().mockResolvedValue(options.platform ?? false),
  });

  const chats = partial<ChatReaderPort>({
    setupChatsOf: vi.fn().mockResolvedValue(options.chats ?? []),
  });

  return new SetupStatus(
    connections,
    runners,
    chats,
    partial<ChatRepository>({}),
  ).of(WORKSPACE, TEAM);
};

describe('SetupStatus', () => {
  it('says a team that has done nothing has done nothing', async () => {
    await expect(read()).resolves.toEqual({
      state: {
        connectedToGitHub: false,
        hasHarness: false,
        configured: false,
      },
      runners: { platform: false },
      hasEgressCapableRunner: false,
      chat: null,
    });
  });

  it('says whether the deployment gives the workspace platform runners', async () => {
    await expect(read({ platform: true })).resolves.toMatchObject({
      runners: { platform: true },
    });
  });

  it('reads back the setup status of a workspace', async () => {
    await expect(
      read({ connected: true, harness: true }),
    ).resolves.toMatchObject({
      state: { connectedToGitHub: true, hasHarness: true },
    });
  });

  it('has no harness where nothing is ready to run', async () => {
    await expect(
      read({ connected: true, harness: false }),
    ).resolves.toMatchObject({ state: { hasHarness: false } });
  });

  it('tells a host that runs sandboxes from a push pool alone', async () => {
    await expect(read({ harness: true, hosted: false })).resolves.toMatchObject(
      {
        state: { hasHarness: true },
        hasEgressCapableRunner: false,
      },
    );
  });

  it('is not configured while the setup chat has opened no pull request', async () => {
    const chat = {
      id: 'chat_1',
      repository: 'acme/infra',
      pullRequest: null,
      ci: null,
      startedById: 'user_1',
      startedBy: 'Ada',
      startedAt: new Date('2026-10-01T09:00:00.000Z'),
    };

    await expect(read({ chats: [chat] })).resolves.toMatchObject({
      state: { configured: false },
      chat,
    });
  });

  it('is configured once the setup chat opened its pull request', async () => {
    await expect(
      read({
        chats: [
          {
            id: 'chat_2',
            repository: 'acme/infra',
            pullRequest: null,
            ci: null,
            startedById: 'user_1',
            startedBy: 'Ada',
            startedAt: new Date('2026-10-02T09:00:00.000Z'),
          },
          {
            id: 'chat_1',
            repository: 'acme/infra',
            pullRequest: 'https://github.com/acme/infra/pull/12',
            ci: null,
            startedById: 'user_1',
            startedBy: 'Ada',
            startedAt: new Date('2026-10-01T09:00:00.000Z'),
          },
        ],
      }),
    ).resolves.toMatchObject({
      state: { configured: true },
      chat: { id: 'chat_1' },
    });
  });
});
