import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ChatReaderPort,
  SetupChatView,
} from '@work/application/ports/chat-reader.port';
import { SetupStatus } from '@work/application/services/setup-status.service';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('123e4567-e89b-42d3-a456-426614174001');

const TEAM = TeamId.of('team_1');

type Options = {
  connected?: boolean;
  harness?: boolean;
  hosted?: boolean;
  chat?: SetupChatView | null;
};

const read = (options: Options = {}) => {
  const connections = {
    isConnected: vi.fn().mockResolvedValue(options.connected ?? false),
  } as unknown as WorkspaceConnectionsPort;

  const runners = {
    readyToRun: vi.fn().mockResolvedValue(options.harness ?? false),
    hasEgressCapableRunner: vi.fn().mockResolvedValue(options.hosted ?? false),
  } as unknown as RunnerReaderPort;

  const chats = {
    setupOf: vi.fn().mockResolvedValue(options.chat ?? null),
  } as unknown as ChatReaderPort;

  return new SetupStatus(connections, runners, chats).of(WORKSPACE, TEAM);
};

describe('SetupStatus', () => {
  it('says a team that has done nothing has done nothing', async () => {
    await expect(read()).resolves.toEqual({
      state: {
        connectedToGitHub: false,
        hasHarness: false,
        configured: false,
      },
      hasEgressCapableRunner: false,
      chat: null,
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
      pullRequest: null,
      startedById: 'user_1',
      startedBy: 'Ada',
    };

    await expect(read({ chat })).resolves.toMatchObject({
      state: { configured: false },
      chat,
    });
  });

  it('is configured once the setup chat opened its pull request', async () => {
    await expect(
      read({
        chat: {
          id: 'chat_1',
          pullRequest: 'https://github.com/acme/infra/pull/12',
          startedById: 'user_1',
          startedBy: 'Ada',
        },
      }),
    ).resolves.toMatchObject({ state: { configured: true } });
  });
});
