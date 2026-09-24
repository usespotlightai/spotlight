import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import { HostReach } from '@integrations/application/services/host-reach.service';
import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { injecting } from '@integrations/integrations.secrets.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const integration = (connects: boolean) =>
  Integration.of({ source: SourceKey.of('slack'), connects });

const BOUND = {
  SLACK_BOT_TOKEN: { host: 'slack.com', prefix: 'Bearer ', value: 'xoxb-1' },
};

const reaching = (token: string | null, inWorkspace = true) => {
  const of = vi.fn(async () =>
    token
      ? ({ accessToken: AccessToken.of(token) } as unknown as HostConnection)
      : null,
  );
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
    reach: new HostReach(
      { of } as unknown as HostConnectionRepository,
      { find, inWorkspace: vi.fn() } satisfies TeamDirectoryPort,
      secrets.injection,
    ),
    of,
    find,
    ...secrets,
  };
};

const headersWorn = async (
  worn: Promise<{ applyTo(headers: Record<string, string>): void }>,
) => {
  const headers: Record<string, string> = {};
  (await worn).applyTo(headers);

  return headers;
};

describe('HostReach', () => {
  it('hands over no connection where the integration makes none', async () => {
    const { reach, of } = reaching('xoxp-2');

    expect((await reach.of(TEAM, integration(false))).connection).toBeNull();
    expect(of).not.toHaveBeenCalled();
  });

  it('hands over the token of a connection the team made', async () => {
    const { reach, of } = reaching('xoxp-2');

    const reached = await reach.of(TEAM, integration(true));

    expect(reached.connection?.value).toBe('xoxp-2');
    expect(of).toHaveBeenCalledWith(TEAM, SourceKey.of('slack'));
  });

  it('lets Spotlight’s own calls wear the secrets of the team’s workspace', async () => {
    const { reach, forSpotlight } = reaching(null);

    const reached = await reach.of(TEAM, integration(false));

    expect(
      await headersWorn(
        reached.credentials.wornToward('https://slack.com/api/x', [
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

  it('looks the workspace up only when a call wears a secret', async () => {
    const { reach, find } = reaching(null);

    await reach.of(TEAM, integration(false));

    expect(find).not.toHaveBeenCalled();
  });

  it('refuses to wear secrets for a team no workspace holds', async () => {
    const { reach } = reaching(null, false);

    const reached = await reach.of(TEAM, integration(false));

    await expect(
      reached.credentials.wornToward('https://slack.com/api/x', [
        'SLACK_BOT_TOKEN',
      ]),
    ).rejects.toThrow(/which no workspace holds/);
  });

  it('grants a run the secrets it wears before it reaches the host', async () => {
    const { reach, grant, forRun } = reaching(null);

    const reached = await reach.forRun(
      {
        teamId: TEAM,
        workspaceId: 'ws_1',
        runId: 'run_1',
        wears: ['SLACK_BOT_TOKEN'],
      },
      integration(false),
    );
    await reached.credentials.wornToward('https://slack.com/api/x', [
      'SLACK_BOT_TOKEN',
    ]);

    expect(grant).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      runId: 'run_1',
      secrets: ['SLACK_BOT_TOKEN'],
    });
    expect(forRun).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      runId: 'run_1',
      secrets: ['SLACK_BOT_TOKEN'],
      url: 'https://slack.com/api/x',
    });
  });

  it('grants nothing to a run whose tool wears no secret', async () => {
    const { reach, grant } = reaching(null);

    await reach.forRun(
      { teamId: TEAM, workspaceId: 'ws_1', runId: 'run_1', wears: [] },
      integration(false),
    );

    expect(grant).not.toHaveBeenCalled();
  });
});
