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
import type { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { Integration } from '@integrations/domain/value-objects/integration.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const authorizing = (allowed: boolean, member = true) =>
  ({
    viewableBy: vi.fn(),
    mayView: vi.fn(),
    inWorkspace: vi.fn(),
    inWorkspaceOfTeam: vi.fn(async () =>
      member
        ? {
            workspaceId: WorkspaceId.of('ws_1'),
            slug: 'acme',
            viewer: UserId.of('user_1'),
            teamId: TeamId.of('team_1'),
            isAdmin: allowed,
          }
        : null,
    ),
    permissionsIn: vi.fn(),
    permissionsInSlug: vi.fn(),
    permissionsInWorkspaceOfTeam: vi.fn(),
    permissionsAsTeamReader: vi.fn(),
    mayPlan: vi.fn(),
  }) satisfies WorkspaceAccessPort;

const CONNECTED_AT = new Date('2026-09-07T10:00:00.000Z');

const STARTED = {
  url: 'https://slack.com/oauth/authorize?state=x',
  nonce: 'n-1',
  expiresAt: new Date('2026-09-07T10:10:00.000Z'),
};

const CLIENT = { id: 'c-1', secret: 's-1' };

describe('BeginOAuth2ConnectionHandler', () => {
  const beginning = (
    over: { allowed?: boolean; member?: boolean; actsAs?: ActsAs } = {},
  ) => {
    const begin = vi.fn(async () => STARTED);
    const scoped: string[] = [];
    const clientFor = vi.fn(async () => CLIENT);
    const integration = Integration.of({
      key: IntegrationKey.of('slack'),
      requiresConnection: true,
      actsAs: over.actsAs ?? ActsAs.team(),
    });

    return {
      begin,
      clientFor,
      scoped,
      handler: new BeginOAuth2ConnectionHandler(
        authorizing(over.allowed ?? true, over.member ?? true),
        { ofTeam: async () => [] } as unknown as DefinedIntegrationsPort,
        {
          integrations: () => [integration],
        } as unknown as IntegrationRuntimePort,
        {
          begin,
          registrationFor: async () => ({
            endpoint: 'https://slack.com/register',
            server: null,
          }),
        } as unknown as OAuth2LinkingPort,
        { clientFor } as unknown as OAuth2ClientResolution,
        {
          within: async (workspace, work) => {
            scoped.push(workspace);
            return work();
          },
          withinFresh: async (_workspace, work) => work(),
        } satisfies WorkspaceOutboundScopePort,
      ),
    };
  };

  const command = (
    owner: 'team' | 'person' = 'team',
    returnTo: string | null = null,
  ) =>
    new BeginOAuth2ConnectionCommand(
      'team_1',
      'slack',
      'user_1',
      owner,
      returnTo,
    );

  it('returns the authorize URL for an admin connecting the team', async () => {
    const { handler, begin } = beginning();

    expect(await handler.execute(command())).toBe(STARTED);
    expect(begin).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        integration: 'slack',
        by: 'user_1',
        owner: 'team',
        returnTo: null,
      },
      CLIENT,
    );
  });

  it('registers the app, where it must, within the outbound scope of the team’s workspace', async () => {
    const { handler, clientFor, scoped } = beginning();

    await handler.execute(command());

    expect(scoped).toEqual(['ws_1']);
    expect(clientFor).toHaveBeenCalledWith(
      TeamId.of('team_1'),
      IntegrationKey.of('slack'),
      'https://slack.com/register',
      null,
    );
  });

  it('begins nothing where no app is registered for the integration', async () => {
    const { handler, clientFor, begin } = beginning();
    clientFor.mockResolvedValueOnce(null as never);

    expect(await handler.execute(command())).toBeNull();
    expect(begin).not.toHaveBeenCalled();
  });

  it('denies someone who may not connect the team', async () => {
    const { handler, begin } = beginning({ allowed: false });

    expect(await handler.execute(command())).toBeNull();
    expect(begin).not.toHaveBeenCalled();
  });

  it('lets any member connect their own account where the integration acts as each person', async () => {
    const { handler, begin } = beginning({
      allowed: false,
      actsAs: ActsAs.requester(),
    });

    expect(
      await handler.execute(command('person', '/w/acme/inbox/task_1')),
    ).toBe(STARTED);
    expect(begin).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'person',
        returnTo: '/w/acme/inbox/task_1',
      }),
      CLIENT,
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
      actsAs: ActsAs.requester(),
    });

    expect(await handler.execute(command('person'))).toBeNull();
    expect(begin).not.toHaveBeenCalled();
  });
});

describe('FinishOAuth2ConnectionHandler', () => {
  const authorized: OAuth2Authorized = {
    teamId: 'team_1',
    integration: 'slack',
    by: 'user_1',
    owner: 'team',
    returnTo: null,
    tokens: OAuthTokens.of({ accessToken: 'xoxb-1', linkedAccount: 'Acme' }),
  };

  const finishing = (
    over: {
      authorized?: OAuth2Authorized | null;
      allowed?: boolean;
      member?: boolean;
      actsAs?: ActsAs;
      existing?: IntegrationConnection;
    } = {},
  ) => {
    const integration = Integration.of({
      key: IntegrationKey.of('slack'),
      requiresConnection: true,
      actsAs: over.actsAs ?? ActsAs.requester(),
    });
    const dispatch = vi.fn(
      async (_events: readonly { kind: string }[]) => undefined,
    );
    const save = vi.fn(async (connection: IntegrationConnection) => {
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
        of: vi.fn(async () => over.existing ?? null),
        expiringBefore: vi.fn(),
      } as unknown as IntegrationConnectionRepository,
      authorizing(over.allowed ?? true, over.member ?? true),
      { ofTeam: async () => [] } as unknown as DefinedIntegrationsPort,
      {
        integrations: () => [integration],
      } as unknown as IntegrationRuntimePort,
      {
        inTransaction: (work: () => Promise<unknown>) => work(),
      } as TransactionPort,
      { now: () => CONNECTED_AT } as ClockPort,
    );

    return { handler, save, dispatch, returned, landingFor };
  };

  const command = () =>
    new FinishOAuth2ConnectionCommand('the-state', 'the-code', 'n-1', 'user_1');

  it('connects the integration, saves it, announces it, and says where to go', async () => {
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
      'integrations.integration-connected',
    );
    expect(to).toBe(
      'https://app.example/w/acme/settings/team/team_1/integrations?connected=slack',
    );
  });

  it('reconnects a live connection in place, keeping its version and clearing a failed refresh', async () => {
    const existing = IntegrationConnection.rehydrate({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      integration: IntegrationKey.of('slack'),
      owner: ConnectionOwner.team(),
      accessToken: AccessToken.of('xoxb-old'),
      refreshToken: AccessToken.of('xoxe-old'),
      expiresAt: null,
      scopes: [],
      linkedAccount: 'Acme',
      refreshFailedAt: new Date('2026-09-06T10:00:00.000Z'),
      refreshClaim: null,
      connectedAt: new Date('2026-09-01T10:00:00.000Z'),
      version: 4,
    });
    const { handler, save, dispatch } = finishing({ existing });

    await handler.execute(command());

    const connection = save.mock.calls[0]?.[0];
    expect(connection?.version).toBe(4);
    expect(connection?.accessToken.value).toBe('xoxb-1');
    expect(connection?.refreshToken).toBeNull();
    expect(connection?.usable).toBe(true);
    expect(connection?.connectedAt).toEqual(CONNECTED_AT);
    expect(dispatch.mock.calls[0]?.[0]?.map((each) => each.kind)).toEqual([
      'integrations.integration-connected',
    ]);
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
        owner: 'person',
        returnTo: '/w/acme/inbox/task_1',
      },
    });

    await handler.execute(command());

    expect(save.mock.calls[0]?.[0]?.owner.personId?.value).toBe('user_1');
    expect(landingFor).toHaveBeenCalledWith(
      'team_1',
      'slack',
      '/w/acme/inbox/task_1',
    );
  });

  it('denies a person’s own connection once they left the team', async () => {
    const { handler, save } = finishing({
      member: false,
      authorized: { ...authorized, owner: 'person' },
    });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a person’s own connection once the integration acts as the team', async () => {
    const { handler, save } = finishing({
      actsAs: ActsAs.team(),
      authorized: { ...authorized, owner: 'person' },
    });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});
