import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
import { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import {
  BeginOAuth2ConnectionHandler,
  FinishOAuth2ConnectionHandler,
} from '@integrations/application/commands/handlers/oauth2-connection.handler';
import { OAuth2ClientMissingError } from '@integrations/application/errors/oauth2-client-missing.error';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type {
  OAuth2Authorized,
  OAuth2LinkingPort,
  OAuth2Refused,
} from '@integrations/application/ports/oauth2-linking.port';
import type { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { Integration } from '@integrations/domain/value-objects/integration.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { RefreshToken } from '@integrations/domain/value-objects/refresh-token.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const authorizing = (allowed: boolean, member = true) =>
  ({
    mayView: vi.fn(),
    viewableOf: vi.fn(),
    inWorkspace: vi.fn(),
    teamAccessIn: vi.fn(),
    teamAccessOfMembers: vi.fn(),
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
    permissionsAsTeamMember: vi.fn(),
    joinedTeam: vi.fn(),
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
    over: {
      allowed?: boolean;
      member?: boolean;
      actsAs?: ActsAs;
      defined?: boolean;
    } = {},
  ) => {
    const begin = vi.fn(async () => STARTED);
    const scoped: string[] = [];
    const clientFor = vi.fn(async () => CLIENT);
    const registrationFor = vi.fn(async () => ({
      endpoint: 'https://slack.com/register' as string | null,
      server: null,
    }));
    const integration = Integration.of({
      key: IntegrationKey.of('slack'),
      apiSpecs: ['mcp'],
      connectsOver: 'oauth2',
      actsAs: over.actsAs ?? ActsAs.team(),
    });

    return {
      begin,
      clientFor,
      registrationFor,
      scoped,
      handler: new BeginOAuth2ConnectionHandler(
        authorizing(over.allowed ?? true, over.member ?? true),
        { ofTeam: async () => [] } as unknown as DefinedIntegrationsPort,
        {
          integrations: () => (over.defined === false ? [] : [integration]),
        } as unknown as IntegrationRuntimePort,
        { begin, registrationFor } as unknown as OAuth2LinkingPort,
        { clientFor } as unknown as OAuth2ClientResolution,
        {
          within: async (workspace, work) => {
            scoped.push(workspace.value);
            return work();
          },
          withinFresh: async (_workspace, work) => work(),
        } satisfies WorkspaceOutboundScopePort,
      ),
    };
  };

  const command = (
    actsAs: 'team' | 'requester' | null = null,
    returnTo: string | null = null,
  ) =>
    new BeginOAuth2ConnectionCommand(
      'team_1',
      'slack',
      'user_1',
      actsAs,
      returnTo,
    );

  it('returns the authorize URL for an admin connecting the team', async () => {
    const { handler, begin } = beginning();

    expect(await handler.execute(command())).toBe(STARTED);
    expect(begin).toHaveBeenCalledWith(
      {
        teamId: TeamId.of('team_1'),
        integration: IntegrationKey.of('slack'),
        by: UserId.of('user_1'),
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

  it('passes on why no OAuth2 client was found', async () => {
    const { handler, clientFor, begin } = beginning();
    const missing = new OAuth2ClientMissingError('slack');
    clientFor.mockRejectedValueOnce(missing);

    await expect(handler.execute(command())).rejects.toBe(missing);
    expect(begin).not.toHaveBeenCalled();
  });

  it('refuses where the integration has no OAuth2 endpoints', async () => {
    const { handler, clientFor, registrationFor } = beginning();
    registrationFor.mockResolvedValueOnce(null as never);

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'upstream-error',
      message: 'OAuth2 endpoints for integration slack not found.',
    });
    expect(clientFor).not.toHaveBeenCalled();
  });

  it('refuses where the linking does not begin', async () => {
    const { handler, begin } = beginning();
    begin.mockResolvedValueOnce(null as never);

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'upstream-error',
      message: 'OAuth2 endpoints for integration slack not found.',
    });
  });

  it('denies a member who may not connect the team', async () => {
    const { handler, begin } = beginning({ allowed: false });

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'not-allowed',
      message: 'Only a workspace owner or admin can connect a team account.',
    });
    expect(begin).not.toHaveBeenCalled();
  });

  it('lets any member connect their own account where the integration acts as each person', async () => {
    const { handler, begin } = beginning({
      allowed: false,
      actsAs: ActsAs.requester(),
    });

    expect(
      await handler.execute(command('requester', '/w/acme/inbox/task_1')),
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

    await expect(handler.execute(command('requester'))).rejects.toMatchObject({
      kind: 'not-found',
      message: "Integration slack doesn't take a personal account.",
    });
    expect(begin).not.toHaveBeenCalled();
  });

  it('refuses an integration the team does not define', async () => {
    const { handler, begin } = beginning({ defined: false });

    await expect(handler.execute(command())).rejects.toMatchObject({
      kind: 'not-found',
      message: 'Integration slack not found.',
    });
    expect(begin).not.toHaveBeenCalled();
  });

  it('denies someone who is not on the team, as if the team did not exist', async () => {
    const { handler, begin } = beginning({
      member: false,
      actsAs: ActsAs.requester(),
    });

    await expect(handler.execute(command('requester'))).rejects.toMatchObject({
      kind: 'not-found',
      message: 'Team team_1 not found.',
    });
    expect(begin).not.toHaveBeenCalled();
  });
});

describe('FinishOAuth2ConnectionHandler', () => {
  const authorized: OAuth2Authorized = {
    teamId: TeamId.of('team_1'),
    integration: IntegrationKey.of('slack'),
    by: UserId.of('user_1'),
    owner: 'team',
    returnTo: null,
    tokens: OAuthTokens.of({ accessToken: 'xoxb-1', linkedAccount: 'Acme' }),
  };

  const finishing = (
    over: {
      authorized?: OAuth2Authorized | OAuth2Refused;
      allowed?: boolean;
      member?: boolean;
      actsAs?: ActsAs;
      existing?: IntegrationConnection;
    } = {},
  ) => {
    const integration = Integration.of({
      key: IntegrationKey.of('slack'),
      apiSpecs: ['mcp'],
      connectsOver: 'oauth2',
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

    const returned = vi.fn(async () => over.authorized ?? authorized);
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } satisfies LoggerPort;

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
      logger,
    );

    return { handler, save, dispatch, returned, landingFor, logger };
  };

  const command = () =>
    new FinishOAuth2ConnectionCommand('the-state', 'the-code', 'n-1', 'user_1');

  it('connects the integration, saves it, announces it, and says where to go', async () => {
    const { handler, save, dispatch, returned, logger } = finishing();

    const to = await handler.execute(command());

    expect(logger.info).not.toHaveBeenCalled();
    expect(returned).toHaveBeenCalledWith({
      state: 'the-state',
      code: 'the-code',
      nonce: 'n-1',
      viewerId: UserId.of('user_1'),
    });
    const connection = save.mock.calls[0]?.[0];
    expect(connection?.teamId.value).toBe('team_1');
    expect(connection?.workspaceId.value).toBe('ws_1');
    expect(connection?.accessToken.value).toBe('xoxb-1');
    expect(dispatch.mock.calls[0]?.[0]?.map((each) => each.kind)).toContain(
      'integration.connected',
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
      refreshToken: RefreshToken.of('xoxe-old'),
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
      'integration.connected',
    ]);
  });

  it('stores nothing when the callback is not valid', async () => {
    const { handler, save, logger } = finishing({
      authorized: {
        refused: 'no-client',
        teamId: TeamId.of('team_1'),
        integration: IntegrationKey.of('slack'),
      },
    });

    expect(await handler.execute(command())).toBeNull();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      { teamId: 'team_1', integration: 'slack', reason: 'no-client' },
      'Did not finish an OAuth2 connection',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('logs a refusal before the state opens with its reason alone', async () => {
    const { handler, logger } = finishing({
      authorized: { refused: 'state-not-accepted' },
    });

    expect(await handler.execute(command())).toBeNull();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      {
        teamId: undefined,
        integration: undefined,
        reason: 'state-not-accepted',
      },
      'Did not finish an OAuth2 connection',
    );
  });

  it('re-checks the authorizer may still connect, and denies if not', async () => {
    const { handler, save, logger } = finishing({ allowed: false });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      {
        teamId: 'team_1',
        integration: 'slack',
        owner: 'team',
        reason: 'not-allowed',
      },
      'Did not finish an OAuth2 connection',
    );
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
      TeamId.of('team_1'),
      IntegrationKey.of('slack'),
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
    const { handler, save, logger } = finishing({
      actsAs: ActsAs.team(),
      authorized: { ...authorized, owner: 'person' },
    });

    expect(await handler.execute(command())).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      {
        teamId: 'team_1',
        integration: 'slack',
        owner: 'person',
        reason: 'takes-no-connection',
      },
      'Did not finish an OAuth2 connection',
    );
  });
});
