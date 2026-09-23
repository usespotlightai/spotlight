import type { HeldSecretsPort } from '@configuration/application/ports/held-secrets.port';
import { HostReach } from '@integrations/application/services/host-reach.service';
import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { Integration } from '@integrations/domain/entities/integration.entity';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const integration = (connects: boolean, credentials: string[] = []) =>
  Integration.of({
    source: SourceKey.of('slack'),
    credentials: credentials.map((each) => SecretName.of(each)),
    connects,
  });

const reaching = (token: string | null, held: string[] = []) => {
  const of = vi.fn(async () =>
    token
      ? ({ accessToken: AccessToken.of(token) } as unknown as HostConnection)
      : null,
  );
  const secrets = {
    held: vi.fn(async () => held.map((each) => SecretName.of(each))),
  } satisfies HeldSecretsPort;

  return {
    reach: new HostReach(secrets, {
      of,
    } as unknown as HostConnectionRepository),
    of,
    secrets,
  };
};

describe('HostReach', () => {
  it('hands over no connection where the integration makes none', async () => {
    const { reach, of } = reaching('xoxp-2');

    await expect(reach.of(TEAM, integration(false))).resolves.toEqual({
      connection: null,
    });
    expect(of).not.toHaveBeenCalled();
  });

  it('hands over the token of a connection the team made', async () => {
    const { reach, of } = reaching('xoxp-2');

    const reached = await reach.of(TEAM, integration(true));

    expect(reached.connection?.value).toBe('xoxp-2');
    expect(of).toHaveBeenCalledWith(TEAM, SourceKey.of('slack'));
  });

  it('asks what the team holds', async () => {
    const { reach, secrets } = reaching(null, ['SLACK_BOT_TOKEN']);

    await reach.of(TEAM, integration(false, ['SLACK_BOT_TOKEN']));

    expect(secrets.held).toHaveBeenCalledWith(TEAM);
  });

  it('refuses an integration that reads a secret the team does not hold', async () => {
    const { reach, of } = reaching('xoxp-2');

    await expect(
      reach.of(TEAM, integration(true, ['SLACK_BOT_TOKEN'])),
    ).rejects.toMatchObject({
      violation: 'conflict',
      message:
        'The slack integration reads secret.SLACK_BOT_TOKEN, which the team does not hold',
    });
    expect(of).not.toHaveBeenCalled();
  });
});
