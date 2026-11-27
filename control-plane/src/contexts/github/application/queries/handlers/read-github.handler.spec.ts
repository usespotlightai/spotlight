import type { GitHubAppPort } from '@github/application/ports/github-app.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import { ReadGitHubHandler } from '@github/application/queries/handlers/read-github.handler';
import { ReadGitHubQuery } from '@github/application/queries/read-github.query';
import type {
  WorkspaceDetail,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const INSTALL = 'https://github.com/apps/spotlight/installations/new';

const reading = (
  over: {
    member?: boolean;
    connected?: boolean;
    installUrl?: string | null;
  } = {},
) => {
  const connections = {
    isConnected: vi.fn(() => Promise.resolve(over.connected ?? false)),
  } satisfies WorkspaceConnectionsPort;

  const handler = new ReadGitHubHandler(
    partial<WorkspaceReaderPort>({
      findForMember: vi.fn(() =>
        Promise.resolve(
          over.member === false
            ? null
            : partial<WorkspaceDetail>({ id: 'ws_1' }),
        ),
      ),
    }),
    connections,
    {
      installUrl: vi.fn(() =>
        Promise.resolve(
          over.installUrl === undefined ? INSTALL : over.installUrl,
        ),
      ),
    } satisfies GitHubAppPort,
  );

  return {
    connections,
    read: () => handler.execute(new ReadGitHubQuery('acme', 'user_1')),
  };
};

describe('ReadGitHubHandler', () => {
  it('says whether the workspace is connected, and where the App is installed', async () => {
    const { read, connections } = reading({ connected: true });

    await expect(read()).resolves.toEqual({
      connected: true,
      installUrl: INSTALL,
    });
    expect(connections.isConnected).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
    );
  });

  it('says it is not connected before the App is installed', async () => {
    await expect(reading().read()).resolves.toMatchObject({ connected: false });
  });

  it('still answers where GitHub would not say what the App is called', async () => {
    await expect(reading({ installUrl: null }).read()).resolves.toMatchObject({
      installUrl: null,
    });
  });

  it('answers with nothing where the workspace is not the caller’s', async () => {
    await expect(reading({ member: false }).read()).resolves.toBeNull();
  });
});
