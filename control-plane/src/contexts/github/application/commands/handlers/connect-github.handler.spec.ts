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
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const membership = (administers = true): WorkspaceMembership => ({
  workspaceId: WorkspaceId.of('ws_1'),
  slug: 'acme',
  viewer: UserId.of('user_1'),
  administers,
});

const connecting = (
  over: {
    membership?: WorkspaceMembership | null;
    administration?: InstallationAdministration;
    claimedBy?: WorkspaceId | null;
  } = {},
) => {
  const events = { dispatch: vi.fn().mockResolvedValue(undefined) };
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
    of: vi.fn(async () => over.administration ?? 'administers'),
  } satisfies InstallationAdministrationPort;

  const handler = new ConnectGitHubHandler(
    {
      viewableBy: vi.fn(),
      mayView: vi.fn(),
      onTeam: vi.fn(),
      inWorkspace: vi.fn(async () =>
        over.membership === undefined ? membership() : over.membership,
      ),
      permissionsIn: vi.fn(),
      permissionsOnTeam: vi.fn(),
      permissionsAsTeamReader: vi.fn(),
      mayPlan: vi.fn(),
    } satisfies WorkspaceAccessPort,
    {
      of: vi.fn(async (id: WorkspaceId) => GitHubConnection.none(id)),
      claimantOf: vi.fn(async () => over.claimedBy ?? null),
      lockedClaimantOf: vi.fn(async () => over.claimedBy ?? null),
      save,
    } satisfies GitHubConnectionRepository,
    administration,
    transaction,
  );

  return { handler, save, events, administration, inTransaction };
};

const command = (installationId = '81234567') =>
  new ConnectGitHubCommand('acme', 'user_1', installationId);

describe('ConnectGitHubHandler', () => {
  it('points the workspace at the installation', async () => {
    const { handler, save } = connecting();

    expect(await handler.execute(command())).toBe('ws_1');

    const [saved] = save.mock.calls[0] as [GitHubConnection];
    expect(saved.installation).toEqual(GitHubInstallation.of('81234567'));
  });

  it('dispatches that the workspace was connected', async () => {
    const { handler, events } = connecting();

    await handler.execute(command());

    const [raised] = events.dispatch.mock.calls[0] as [readonly DomainEvent[]];
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

  it('denies an installation the caller does not administer', async () => {
    const { handler, save } = connecting({ administration: 'does-not' });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      ApplicationError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('denies an installation another workspace has', async () => {
    const { handler, save } = connecting({
      claimedBy: WorkspaceId.of('ws_2'),
    });

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('fails, saying so, where GitHub would not answer at all', async () => {
    const { handler, save } = connecting({ administration: 'cannot-tell' });

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
