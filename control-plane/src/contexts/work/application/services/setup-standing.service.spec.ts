import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ChatReaderPort,
  SetupChatView,
} from '@work/application/ports/chat-reader.port';
import { SetupStanding } from '@work/application/services/setup-standing.service';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('123e4567-e89b-42d3-a456-426614174001');

const TEAM = TeamId.of('team_1');

type Given = {
  connected?: boolean;
  harness?: boolean;
  chat?: SetupChatView | null;
};

const read = (given: Given = {}) => {
  const connections = {
    isConnected: vi.fn().mockResolvedValue(given.connected ?? false),
  } as unknown as WorkspaceConnectionsPort;

  const runners = {
    readyToRun: vi.fn().mockResolvedValue(given.harness ?? false),
  } as unknown as RunnerReaderPort;

  const chats = {
    setupOf: vi.fn().mockResolvedValue(given.chat ?? null),
  } as unknown as ChatReaderPort;

  return new SetupStanding(connections, runners, chats).of(WORKSPACE, TEAM);
};

describe('SetupStanding', () => {
  it('says a team that has done nothing has done nothing', async () => {
    await expect(read()).resolves.toEqual({
      state: {
        connectedToGitHub: false,
        hasHarness: false,
        configured: false,
      },
      chat: null,
    });
  });

  it('reads back where a workspace stands', async () => {
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

  it('is not configured while the setup chat has opened no pull request', async () => {
    const chat = { id: 'chat_1', pullRequest: null };

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
        },
      }),
    ).resolves.toMatchObject({ state: { configured: true } });
  });
});
