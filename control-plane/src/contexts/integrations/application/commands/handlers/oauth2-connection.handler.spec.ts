import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import {
  BeginOAuth2ConnectionHandler,
  FinishOAuth2ConnectionHandler,
} from '@integrations/application/commands/handlers/oauth2-connection.handler';
import type {
  OAuth2Authorized,
  OAuth2LinkingPort,
} from '@integrations/application/ports/oauth2-linking.port';
import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const authorizing = (allowed: boolean) =>
  ({
    viewableBy: vi.fn(),
    mayView: vi.fn(),
    inWorkspace: vi.fn(),
    onTeam: vi.fn(async () => ({
      workspaceId: WorkspaceId.of('ws_1'),
      slug: 'acme',
      viewer: UserId.of('user_1'),
      teamId: TeamId.of('team_1'),
      administers: allowed,
    })),
    clearanceIn: vi.fn(),
    clearanceOnTeam: vi.fn(),
    mayPlan: vi.fn(),
  }) satisfies WorkspaceAccessPort;

const BEGUN = {
  url: 'https://slack.com/oauth/authorize?state=x',
  nonce: 'n-1',
  expiresAt: new Date('2026-09-07T10:10:00.000Z'),
};

describe('BeginOAuth2ConnectionHandler', () => {
  const beginning = (allowed = true) => {
    const begin = vi.fn(async () => BEGUN);

    return {
      begin,
      handler: new BeginOAuth2ConnectionHandler(authorizing(allowed), {
        begin,
      } as unknown as OAuth2LinkingPort),
    };
  };

  const command = () =>
    new BeginOAuth2ConnectionCommand('team_1', 'slack', 'user_1');

  it('returns the authorize URL for a person who may connect', async () => {
    const { handler, begin } = beginning();

    expect(await handler.execute(command())).toBe(BEGUN);
    expect(begin).toHaveBeenCalledWith('team_1', 'slack', 'user_1');
  });

  it('refuses someone who may not connect', async () => {
    const { handler, begin } = beginning(false);

    expect(await handler.execute(command())).toBeNull();
    expect(begin).not.toHaveBeenCalled();
  });
});

describe('FinishOAuth2ConnectionHandler', () => {
  const authorized: OAuth2Authorized = {
    teamId: 'team_1',
    source: 'slack',
    by: 'user_1',
    grant: HostGrant.of({ accessToken: 'xoxb-1', handle: 'Acme' }),
  };

  const finishing = (
    over: { authorized?: OAuth2Authorized | null; allowed?: boolean } = {},
  ) => {
    const dispatch = vi.fn(
      async (_events: readonly { kind: string }[]) => undefined,
    );
    const save = vi.fn(async (connection: HostConnection) => {
      await dispatch(connection.pullEvents());
    });
    const landingFor = vi.fn(
      async () =>
        'https://app.example/w/acme/team/team_1/settings/integrations?connected=slack',
    );

    const returned = vi.fn(async () =>
      'authorized' in over ? over.authorized : authorized,
    );

    const handler = new FinishOAuth2ConnectionHandler(
      {
        authorized: returned,
        landingFor,
      } as unknown as OAuth2LinkingPort,
      {
        save,
        of: vi.fn(),
        expiringBefore: vi.fn(),
      } as unknown as HostConnectionRepository,
      authorizing(over.allowed ?? true),
      { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
    );

    return { handler, save, dispatch, returned };
  };

  const command = () =>
    new FinishOAuth2ConnectionCommand('the-state', 'the-code', 'n-1', 'user_1');

  it('links the host, saves it, announces it, and says where to go', async () => {
    const { handler, save, dispatch, returned } = finishing();

    const to = await handler.execute(command());

    expect(returned).toHaveBeenCalledWith({
      state: 'the-state',
      code: 'the-code',
      nonce: 'n-1',
      viewerId: 'user_1',
    });
    const connection = save.mock.calls[0]?.[0];
    expect(connection?.teamId.value).toBe('team_1');
    expect(connection?.workspaceId.value).toBe('ws_1');
    expect(connection?.accessToken.value).toBe('xoxb-1');
    expect(dispatch.mock.calls[0]?.[0]?.map((each) => each.kind)).toContain(
      'integrations.host-connected',
    );
    expect(to).toBe(
      'https://app.example/w/acme/team/team_1/settings/integrations?connected=slack',
    );
  });

  it('stores nothing when the callback does not hold up', async () => {
    const { handler, save } = finishing({ authorized: null });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('re-checks the authorizer may still connect, and refuses if not', async () => {
    const { handler, save } = finishing({ allowed: false });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
