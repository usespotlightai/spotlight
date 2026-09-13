import { BeginOAuth2ConnectionCommand } from '@application/commands/begin-oauth2-connection.command';
import { FinishOAuth2ConnectionCommand } from '@application/commands/finish-oauth2-connection.command';
import {
  BeginOAuth2ConnectionHandler,
  FinishOAuth2ConnectionHandler,
} from '@application/commands/handlers/oauth2-connection.handler';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type {
  OAuth2Authorized,
  OAuth2LinkingPort,
} from '@application/ports/oauth2-linking.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import { HostGrant } from '@domain/value-objects/host-grant.vo';
import { describe, expect, it, vi } from 'vitest';

const authorizing = (allowed: boolean) =>
  ({
    connectableBy: vi.fn(async () => (allowed ? ({} as Workspace) : null)),
  }) as unknown as ConnectionAuthorization;

describe('BeginOAuth2ConnectionHandler', () => {
  const beginning = (allowed = true) => {
    const begin = vi.fn(
      async () => 'https://slack.com/oauth/authorize?state=x',
    );

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

    expect(await handler.execute(command())).toBe(
      'https://slack.com/oauth/authorize?state=x',
    );
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
    const save = vi.fn(async (_connection: HostConnection) => undefined);
    const dispatch = vi.fn(
      async (_events: readonly { kind: string }[]) => undefined,
    );
    const landingFor = vi.fn(
      async () =>
        'https://app.example/w/acme/team/team_1/settings/integrations?connected=slack',
    );

    const handler = new FinishOAuth2ConnectionHandler(
      {
        authorized: async () =>
          'authorized' in over ? over.authorized : authorized,
        landingFor,
      } as unknown as OAuth2LinkingPort,
      {
        save,
        of: vi.fn(),
        held: vi.fn(),
        nearingExpiry: vi.fn(),
      } as unknown as HostConnectionRepository,
      authorizing(over.allowed ?? true),
      { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
      { dispatch } as unknown as DomainEventDispatcher,
    );

    return { handler, save, dispatch };
  };

  const command = () =>
    new FinishOAuth2ConnectionCommand('the-state', 'the-code');

  it('links the host, saves it, announces it, and says where to go', async () => {
    const { handler, save, dispatch } = finishing();

    const to = await handler.execute(command());

    const connection = save.mock.calls[0]?.[0];
    expect(connection?.teamId.value).toBe('team_1');
    expect(connection?.accessToken).toBe('xoxb-1');
    expect(dispatch.mock.calls[0]?.[0]?.map((each) => each.kind)).toContain(
      'host.connected',
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
