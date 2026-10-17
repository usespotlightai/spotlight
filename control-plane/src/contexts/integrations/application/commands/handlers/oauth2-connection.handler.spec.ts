import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import {
  BeginOAuth2ConnectionHandler,
  FinishOAuth2ConnectionHandler,
} from '@integrations/application/commands/handlers/oauth2-connection.handler';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type {
  OAuth2Authorized,
  OAuth2LinkingPort,
} from '@integrations/application/ports/oauth2-linking.port';
import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { ConnectionHolderRule } from '@integrations/domain/value-objects/connection-holder-rule.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const authorizing = (allowed: boolean, member = true) =>
  ({
    viewableBy: vi.fn(),
    mayView: vi.fn(),
    inWorkspace: vi.fn(),
    onTeam: vi.fn(async () =>
      member
        ? {
            workspaceId: WorkspaceId.of('ws_1'),
            slug: 'acme',
            viewer: UserId.of('user_1'),
            teamId: TeamId.of('team_1'),
            administers: allowed,
          }
        : null,
    ),
    permissionsIn: vi.fn(),
    permissionsOnTeam: vi.fn(),
    permissionsAsTeamReader: vi.fn(),
    mayPlan: vi.fn(),
  }) satisfies WorkspaceAccessPort;

const BEGUN = {
  url: 'https://slack.com/oauth/authorize?state=x',
  nonce: 'n-1',
  expiresAt: new Date('2026-09-07T10:10:00.000Z'),
};

describe('BeginOAuth2ConnectionHandler', () => {
  const beginning = (
    over: {
      allowed?: boolean;
      member?: boolean;
      holderRule?: ConnectionHolderRule;
    } = {},
  ) => {
    const begin = vi.fn(async () => BEGUN);
    const integration = Integration.of({
      source: SourceKey.of('slack'),
      connects: true,
      holderRule: over.holderRule ?? ConnectionHolderRule.team(),
    });

    return {
      begin,
      handler: new BeginOAuth2ConnectionHandler(
        authorizing(over.allowed ?? true, over.member ?? true),
        { ofTeam: async () => [] } as unknown as DefinedIntegrationsPort,
        {
          integrations: () => [integration],
        } as unknown as IntegrationRuntimePort,
        { begin } as unknown as OAuth2LinkingPort,
      ),
    };
  };

  const command = (
    holder: 'team' | 'person' = 'team',
    back: string | null = null,
  ) =>
    new BeginOAuth2ConnectionCommand('team_1', 'slack', 'user_1', holder, back);

  it('returns the authorize URL for an admin connecting the team', async () => {
    const { handler, begin } = beginning();

    expect(await handler.execute(command())).toBe(BEGUN);
    expect(begin).toHaveBeenCalledWith({
      teamId: 'team_1',
      source: 'slack',
      by: 'user_1',
      holder: 'team',
      back: null,
    });
  });

  it('denies someone who may not connect the team', async () => {
    const { handler, begin } = beginning({ allowed: false });

    expect(await handler.execute(command())).toBeNull();
    expect(begin).not.toHaveBeenCalled();
  });

  it('lets any member connect their own account where the integration acts as each person', async () => {
    const { handler, begin } = beginning({
      allowed: false,
      holderRule: ConnectionHolderRule.requester(),
    });

    expect(
      await handler.execute(command('person', '/w/acme/inbox/task_1')),
    ).toBe(BEGUN);
    expect(begin).toHaveBeenCalledWith(
      expect.objectContaining({
        holder: 'person',
        back: '/w/acme/inbox/task_1',
      }),
    );
  });

  it('rejects a person’s own connection where the integration acts as the team', async () => {
    const { handler, begin } = beginning();

    expect(await handler.execute(command('person'))).toBeNull();
    expect(begin).not.toHaveBeenCalled();
  });

  it('denies someone who is not on the team', async () => {
    const { handler, begin } = beginning({
      member: false,
      holderRule: ConnectionHolderRule.requester(),
    });

    expect(await handler.execute(command('person'))).toBeNull();
    expect(begin).not.toHaveBeenCalled();
  });

  it('drops a place to land that is not in the app', async () => {
    const { handler, begin } = beginning();

    await handler.execute(command('team', 'https://evil.example/'));

    expect(begin).toHaveBeenCalledWith(expect.objectContaining({ back: null }));
  });
});

describe('FinishOAuth2ConnectionHandler', () => {
  const authorized: OAuth2Authorized = {
    teamId: 'team_1',
    source: 'slack',
    by: 'user_1',
    holder: 'team',
    back: null,
    grant: HostGrant.of({ accessToken: 'xoxb-1', handle: 'Acme' }),
  };

  const finishing = (
    over: {
      authorized?: OAuth2Authorized | null;
      allowed?: boolean;
      member?: boolean;
      holderRule?: ConnectionHolderRule;
    } = {},
  ) => {
    const integration = Integration.of({
      source: SourceKey.of('slack'),
      connects: true,
      holderRule: over.holderRule ?? ConnectionHolderRule.requester(),
    });
    const dispatch = vi.fn(
      async (_events: readonly { kind: string }[]) => undefined,
    );
    const save = vi.fn(async (connection: HostConnection) => {
      await dispatch(connection.pullEvents());
    });
    const landingFor = vi.fn(
      async () =>
        'https://app.example/w/acme/settings/team/team_1/integrations?connected=slack',
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
      authorizing(over.allowed ?? true, over.member ?? true),
      { ofTeam: async () => [] } as unknown as DefinedIntegrationsPort,
      {
        integrations: () => [integration],
      } as unknown as IntegrationRuntimePort,
      {
        inTransaction: (work: () => Promise<unknown>) => work(),
      } as TransactionPort,
    );

    return { handler, save, dispatch, returned, landingFor };
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
      'https://app.example/w/acme/settings/team/team_1/integrations?connected=slack',
    );
  });

  it('stores nothing when the callback is not valid', async () => {
    const { handler, save } = finishing({ authorized: null });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('re-checks the authorizer may still connect, and denies if not', async () => {
    const { handler, save } = finishing({ allowed: false });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('stores a person’s own connection as theirs, and lands where they began', async () => {
    const { handler, save, landingFor } = finishing({
      allowed: false,
      authorized: {
        ...authorized,
        holder: 'person',
        back: '/w/acme/inbox/task_1',
      },
    });

    await handler.execute(command());

    expect(save.mock.calls[0]?.[0]?.holder.personId?.value).toBe('user_1');
    expect(landingFor).toHaveBeenCalledWith(
      'team_1',
      'slack',
      '/w/acme/inbox/task_1',
    );
  });

  it('denies a person’s own connection once they left the team', async () => {
    const { handler, save } = finishing({
      member: false,
      authorized: { ...authorized, holder: 'person' },
    });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a person’s own connection once the integration acts as the team', async () => {
    const { handler, save } = finishing({
      holderRule: ConnectionHolderRule.team(),
      authorized: { ...authorized, holder: 'person' },
    });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
