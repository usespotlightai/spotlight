import { ConnectGitHubCommand } from '@github/application/commands/connect-github.command';
import { ConnectGitHubHandler } from '@github/application/commands/handlers/connect-github.handler';
import type {
  InstallationAdministration,
  InstallationAdministrationPort,
} from '@github/application/ports/installation-administration.port';
import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type {
  WorkspaceAccessPort,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import type {
  WorkspaceProfile,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { firstOf } from '@shared-kernel/domain/item-at';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const membership = (isAdmin = true): WorkspaceMembership => ({
  workspaceId: WorkspaceId.of('ws_1'),
  slug: 'acme',
  viewer: UserId.of('user_1'),
  isAdmin,
});

const connecting = (
  over: {
    membership?: WorkspaceMembership | null;
    administration?: InstallationAdministration;
    connectedWorkspace?: WorkspaceId | null;
    seen?: Record<string, string>;
  } = {},
) => {
  const events = {
    dispatch: vi
      .fn<(raised: readonly DomainEvent[]) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const inTransaction = vi.fn();
  const transaction: TransactionPort = {
    inTransaction: async (work) => {
      inTransaction(true);
      try {
        return await work();
      } finally {
        inTransaction(false);
      }
    },
  };
  const save = vi.fn(async (connection: GitHubConnection) => {
    await events.dispatch(connection.pullEvents());
  });
  const administration = {
    of: vi.fn(async () => over.administration ?? 'admin'),
  } satisfies InstallationAdministrationPort;
  const viewableOf = vi.fn(
    async (_viewer: UserId, ids: readonly WorkspaceId[]) =>
      ids.filter((each) => over.seen?.[each.value] !== undefined),
  );

  const handler = new ConnectGitHubHandler(
    {
      mayView: vi.fn(),
      viewableOf,
      teamAccessIn: vi.fn(),
      teamAccessOfMembers: vi.fn(),
      inWorkspaceOfTeam: vi.fn(),
      inWorkspace: vi.fn(async () =>
        over.membership === undefined ? membership() : over.membership,
      ),
      permissionsIn: vi.fn(),
      permissionsInSlug: vi.fn(),
      permissionsInWorkspaceOfTeam: vi.fn(),
      permissionsAsTeamMember: vi.fn(),
      accessOnTeam: vi.fn(),
      mayPlan: vi.fn(),
    } satisfies WorkspaceAccessPort,
    partial<WorkspaceReaderPort>({
      profileOf: vi.fn(async (id: WorkspaceId) =>
        partial<WorkspaceProfile>({
          id: id.value,
          name: over.seen?.[id.value] ?? '',
        }),
      ),
    }),
    {
      of: vi.fn(async (id: WorkspaceId) => GitHubConnection.none(id)),
      connectedWorkspaceOf: vi.fn(async () => over.connectedWorkspace ?? null),
      lockedConnectedWorkspaceOf: vi.fn(
        async () => over.connectedWorkspace ?? null,
      ),
      save,
    } satisfies GitHubConnectionRepository,
    administration,
    transaction,
  );

  return { handler, save, events, administration, inTransaction, viewableOf };
};

const command = (installationId = '81234567') =>
  new ConnectGitHubCommand('acme', 'user_1', installationId);

describe('ConnectGitHubHandler', () => {
  it('points the workspace at the installation', async () => {
    const { handler, save } = connecting();

    expect(await handler.execute(command())).toBe('ws_1');

    const [saved] = save.mock.calls[0];
    expect(saved.installation).toEqual(GitHubInstallation.of('81234567'));
  });

  it('dispatches that the workspace was connected', async () => {
    const { handler, events } = connecting();

    await handler.execute(command());

    const raised = firstOf(events.dispatch.mock.calls)?.[0] ?? [];
    expect(raised.some((each) => each instanceof WorkspaceConnected)).toBe(
      true,
    );
  });

  it('calls GitHub before any transaction is open', async () => {
    const { handler, administration, inTransaction } = connecting();

    await handler.execute(command());

    expect(administration.of).toHaveBeenCalledWith(
      GitHubInstallation.of('81234567'),
      UserId.of('user_1'),
    );
    expect(administration.of.mock.invocationCallOrder[0]).toBeLessThan(
      inTransaction.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('answers with nothing where there is no such workspace, or the caller is not of it', async () => {
    const { handler, save } = connecting({ membership: null });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('denies a member who is neither owner nor admin, without calling GitHub', async () => {
    const { handler, save, administration } = connecting({
      membership: membership(false),
    });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      ApplicationError,
    );
    expect(save).not.toHaveBeenCalled();
    expect(administration.of).not.toHaveBeenCalled();
  });

  it('denies an installation when the caller is not its admin', async () => {
    const { handler, save } = connecting({ administration: 'not-admin' });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      ApplicationError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('denies an installation another workspace has, naming it where the caller is of it', async () => {
    const { handler, save, viewableOf } = connecting({
      connectedWorkspace: WorkspaceId.of('ws_2'),
      seen: { ws_2: 'Tidepool Labs' },
    });

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'conflict',
      message:
        'Tidepool Labs already uses this GitHub installation. Install the App on another account for this workspace.',
    });
    expect(save).not.toHaveBeenCalled();
    expect(viewableOf).toHaveBeenCalledWith(UserId.of('user_1'), [
      WorkspaceId.of('ws_2'),
    ]);
  });

  it('denies an installation a workspace the caller can’t see has, without naming it', async () => {
    const { handler } = connecting({
      connectedWorkspace: WorkspaceId.of('ws_2'),
    });

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'conflict',
      message:
        'Another workspace already uses this GitHub installation. Install the App on another account for this workspace.',
    });
  });

  it('takes again an installation the workspace already has', async () => {
    const { handler, save, viewableOf } = connecting({
      connectedWorkspace: WorkspaceId.of('ws_1'),
    });

    expect(await handler.execute(command())).toBe('ws_1');
    expect(save).toHaveBeenCalled();
    expect(viewableOf).not.toHaveBeenCalled();
  });

  it('fails, saying so, where GitHub would not answer at all', async () => {
    const { handler, save } = connecting({ administration: 'unknown' });

    await expect(handler.execute(command())).rejects.toThrow(
      /could not confirm this installation is yours/,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a number GitHub could have assigned', async () => {
    const { handler, save } = connecting();

    await expect(handler.execute(command('../../etc'))).rejects.toBeInstanceOf(
      ApplicationError,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
