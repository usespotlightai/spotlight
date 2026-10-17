import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  TeamMembership,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { CallAuthResolver } from '@integrations/application/services/call-auth-resolver.service';
import type { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { injecting } from '@integrations/integrations.secrets.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const integration = (
  requiresConnection: boolean,
  actsAs: ActsAs = ActsAs.team(),
) =>
  Integration.of({
    key: IntegrationKey.of('slack'),
    requiresConnection,
    actsAs,
  });

const ALICE = UserId.of('user_alice');

const BOUND = {
  SLACK_BOT_TOKEN: { host: 'slack.com', prefix: 'Bearer ', value: 'xoxb-1' },
};

const connected = (token: string, owner: ConnectionOwner) =>
  IntegrationConnection.rehydrate({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    integration: IntegrationKey.of('slack'),
    owner,
    accessToken: AccessToken.of(token),
    refreshToken: AccessToken.of('xoxe-1'),
    expiresAt: null,
    scopes: [],
    linkedAccount: '@alice',
    refreshFailedAt: null,
    refreshClaim: null,
    version: 1,
  });

const resolving = (
  token: string | null,
  inWorkspace = true,
  over: { member?: boolean } = {},
) => {
  const of = vi.fn(
    async (_teamId: TeamId, _source: IntegrationKey, owner: ConnectionOwner) =>
      token ? connected(token, owner) : null,
  );
  const onTeam = vi.fn(async () =>
    over.member === false ? null : ({} as TeamMembership),
  );
  const afterUnauthorized = vi.fn(async () => AccessToken.of('xoxp-refreshed'));
  const find = vi.fn(async () =>
    inWorkspace
      ? {
          id: TEAM,
          workspaceId: WorkspaceId.of('ws_1'),
          key: 'platform',
          name: 'Platform',
          members: [],
        }
      : null,
  );
  const secrets = injecting(BOUND);

  return {
    resolver: new CallAuthResolver(
      { of } as unknown as IntegrationConnectionRepository,
      { find, inWorkspace: vi.fn() } satisfies TeamDirectoryPort,
      { onTeam } as unknown as WorkspaceAccessPort,
      secrets.injection,
      { afterUnauthorized } as unknown as ConnectionRefresh,
    ),
    of,
    find,
    onTeam,
    afterUnauthorized,
    ...secrets,
  };
};

const injectedHeaders = async (
  injected: Promise<{
    applyTo(request: { url: URL; headers: Record<string, string> }): void;
  }>,
) => {
  const headers: Record<string, string> = {};
  (await injected).applyTo({
    url: new URL('https://slack.com/api/x'),
    headers,
  });

  return headers;
};

describe('CallAuthResolver', () => {
  it('hands over no connection where the integration makes none', async () => {
    const { resolver, of } = resolving('xoxp-2');

    expect((await resolver.of(TEAM, integration(false))).connection).toBeNull();
    expect(of).not.toHaveBeenCalled();
  });

  it('hands over the token of a connection the team made', async () => {
    const { resolver, of } = resolving('xoxp-2');

    const callAuth = await resolver.of(TEAM, integration(true));

    expect(callAuth.connection?.token.value).toBe('xoxp-2');
    expect(callAuth.connection?.owner).toEqual(ConnectionOwner.team());
    expect(of).toHaveBeenCalledWith(
      TEAM,
      IntegrationKey.of('slack'),
      ConnectionOwner.team(),
    );
  });

  it('uses the team’s connection for polls, schedules and posts even where tools act as each person', async () => {
    const { resolver, of } = resolving('xoxp-2');

    await resolver.of(TEAM, integration(true, ActsAs.requester()));

    expect(of).toHaveBeenCalledWith(
      TEAM,
      IntegrationKey.of('slack'),
      ConnectionOwner.team(),
    );
  });

  it('refreshes through the single refresh when the service does not accept the token', async () => {
    const { resolver, afterUnauthorized } = resolving('xoxp-2');

    const callAuth = await resolver.of(TEAM, integration(true));
    const refreshed = await callAuth.connection?.unauthorized(
      AccessToken.of('xoxp-2'),
    );

    expect(refreshed?.value).toBe('xoxp-refreshed');
    expect(afterUnauthorized).toHaveBeenCalledWith(
      TEAM,
      IntegrationKey.of('slack'),
      ConnectionOwner.team(),
      AccessToken.of('xoxp-2'),
    );
  });

  describe('connectionFor', () => {
    it('takes the requester’s own connection for a tool that acts as each person', async () => {
      const { resolver, of, onTeam } = resolving('xoxp-alice');

      const found = await resolver.connectionFor(
        TEAM,
        integration(true, ActsAs.requester()),
        ALICE,
      );

      expect(found.kind === 'chosen' && found.owner.personId).toEqual(ALICE);
      expect(found.kind === 'chosen' && found.connection?.linkedAccount).toBe(
        '@alice',
      );
      expect(onTeam).toHaveBeenCalledWith('team_1', ALICE);
      expect(of).toHaveBeenCalledWith(
        TEAM,
        IntegrationKey.of('slack'),
        ConnectionOwner.person(ALICE),
      );
    });

    it('wants the requester to connect, rather than using the team’s', async () => {
      const { resolver, of } = resolving(null);

      const found = await resolver.connectionFor(
        TEAM,
        integration(true, ActsAs.requester()),
        ALICE,
      );

      expect(found.kind === 'missing' && found.missing.because).toBe(
        'not-connected',
      );
      expect(of).toHaveBeenCalledTimes(1);
    });

    it('checks the requester is still on the team when the tool is used', async () => {
      const { resolver, of } = resolving('xoxp-alice', true, { member: false });

      const found = await resolver.connectionFor(
        TEAM,
        integration(true, ActsAs.requester()),
        ALICE,
      );

      expect(found.kind === 'missing' && found.missing.because).toBe(
        'not-a-member',
      );
      expect(of).not.toHaveBeenCalled();
    });

    it('takes the team’s connection for a tool that acts as the team, without checking who is on it', async () => {
      const { resolver, onTeam } = resolving('xoxp-2');

      const found = await resolver.connectionFor(
        TEAM,
        integration(true),
        ALICE,
      );

      expect(found.kind === 'chosen' && found.owner).toEqual(
        ConnectionOwner.team(),
      );
      expect(onTeam).not.toHaveBeenCalled();
    });
  });

  it('lets Spotlight’s own calls inject the secrets of the team’s workspace', async () => {
    const { resolver, forSpotlight } = resolving(null);

    const callAuth = await resolver.of(TEAM, integration(false));

    expect(
      await injectedHeaders(
        callAuth.credentials.injectedFor('https://slack.com/api/x', [
          'SLACK_BOT_TOKEN',
        ]),
      ),
    ).toEqual({ authorization: 'Bearer xoxb-1' });
    expect(forSpotlight).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      secrets: ['SLACK_BOT_TOKEN'],
      url: 'https://slack.com/api/x',
    });
  });

  it('looks the workspace up only when a call injects a secret', async () => {
    const { resolver, find } = resolving(null);

    await resolver.of(TEAM, integration(false));

    expect(find).not.toHaveBeenCalled();
  });

  it('does not inject secrets for a team that no workspace has', async () => {
    const { resolver } = resolving(null, false);

    const callAuth = await resolver.of(TEAM, integration(false));

    await expect(
      callAuth.credentials.injectedFor('https://slack.com/api/x', [
        'SLACK_BOT_TOKEN',
      ]),
    ).rejects.toThrow(/which no workspace has/);
  });

  it('grants the run’s current attempt the secrets that it injects before it calls the service', async () => {
    const { resolver, grant, forRun } = resolving(null);

    const callAuth = await resolver.forRun(
      {
        teamId: TEAM,
        workspaceId: 'ws_1',
        runId: 'run_1',
        attempt: 2,
        injectedSecrets: ['SLACK_BOT_TOKEN'],
      },
      null,
    );
    await callAuth.credentials.injectedFor('https://slack.com/api/x', [
      'SLACK_BOT_TOKEN',
    ]);

    expect(grant).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      runId: 'run_1',
      attempt: 2,
      secrets: ['SLACK_BOT_TOKEN'],
    });
    expect(forRun).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      runId: 'run_1',
      attempt: 2,
      secrets: ['SLACK_BOT_TOKEN'],
      url: 'https://slack.com/api/x',
    });
  });

  it('grants nothing to a run whose tool injects no secret', async () => {
    const { resolver, grant } = resolving(null);

    await resolver.forRun(
      {
        teamId: TEAM,
        workspaceId: 'ws_1',
        runId: 'run_1',
        attempt: 1,
        injectedSecrets: [],
      },
      null,
    );

    expect(grant).not.toHaveBeenCalled();
  });
});
