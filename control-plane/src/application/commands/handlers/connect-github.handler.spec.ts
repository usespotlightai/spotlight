import { ConnectGitHubCommand } from '@application/commands/connect-github.command';
import { ConnectGitHubHandler } from '@application/commands/handlers/connect-github.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type {
  Administers,
  GitHubIdentityPort,
} from '@application/ports/github-identity.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { DomainEvent } from '@domain/events/domain-event';
import { WorkspaceConnected } from '@domain/events/workspace-connected.event';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { run: (work) => work() };

const acme = (members: readonly { user: string; role: WorkspaceRole }[]) =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: members.map((each) => ({
      userId: UserId.of(each.user),
      role: each.role,
    })),
    teams: [],
  });

const connecting = (
  over: { workspace?: Workspace | null; administers?: Administers } = {},
) => {
  const save = vi.fn(async () => {});
  const events = { dispatch: vi.fn().mockResolvedValue(undefined) };

  const handler = new ConnectGitHubHandler(
    {
      findBySlug: vi.fn(async () =>
        over.workspace === undefined
          ? acme([{ user: 'user_1', role: 'owner' }])
          : over.workspace,
      ),
      save,
    } as unknown as WorkspaceRepository,
    {
      administers: vi.fn(async () => over.administers ?? 'administers'),
    } as unknown as GitHubIdentityPort,
    transaction,
    events,
  );

  return { handler, save, events };
};

const command = (installationId = '81234567') =>
  new ConnectGitHubCommand('acme', 'user_1', installationId);

describe('ConnectGitHubHandler', () => {
  it('points the workspace at the installation', async () => {
    const { handler, save } = connecting();

    expect(await handler.execute(command())).toBe('ws_1');

    const [saved] = save.mock.calls[0] as never as [Workspace];
    expect(saved.connectionTo('github')).toEqual(
      Connection.of('github', '81234567'),
    );
  });

  // Connecting is worth hearing: what follows from it is dispatched after.
  it('dispatches that the workspace was connected', async () => {
    const { handler, events } = connecting();

    await handler.execute(command());

    const [raised] = events.dispatch.mock.calls[0] as [readonly DomainEvent[]];
    expect(raised.some((each) => each instanceof WorkspaceConnected)).toBe(
      true,
    );
  });

  it('answers with nothing where there is no such workspace', async () => {
    const { handler, save } = connecting({ workspace: null });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  // Someone outside it is not told a workspace is there at all.
  it('answers with nothing where the caller is not of the workspace', async () => {
    const { handler, save } = connecting({
      workspace: acme([{ user: 'someone-else', role: 'owner' }]),
    });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a member who is neither owner nor admin', async () => {
    const { handler, save } = connecting({
      workspace: acme([
        { user: 'owner_1', role: 'owner' },
        { user: 'user_1', role: 'member' },
      ]),
    });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      UseCaseFault,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('lets an admin connect one', async () => {
    const { handler, save } = connecting({
      workspace: acme([
        { user: 'owner_1', role: 'owner' },
        { user: 'user_1', role: 'admin' },
      ]),
    });

    await handler.execute(command());

    expect(save).toHaveBeenCalledTimes(1);
  });

  // The number is a guess anyone could make, so holding it is asked of
  // GitHub rather than taken from whoever sent it.
  it('refuses an installation the caller does not administer', async () => {
    const { handler, save } = connecting({ administers: 'does-not' });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      UseCaseFault,
    );
    expect(save).not.toHaveBeenCalled();
  });

  // A question GitHub would not answer is not an answer of no, and saying so
  // is what stops somebody hunting a permission problem they do not have.
  it('refuses, saying so, where GitHub would not answer at all', async () => {
    const { handler, save } = connecting({ administers: 'cannot-tell' });

    await expect(handler.execute(command())).rejects.toThrow(
      /would not say whether that installation is yours/,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses anything that is not a number GitHub could have given', async () => {
    const { handler, save } = connecting();

    await expect(handler.execute(command('../../etc'))).rejects.toBeInstanceOf(
      UseCaseFault,
    );
    expect(save).not.toHaveBeenCalled();
  });
});
