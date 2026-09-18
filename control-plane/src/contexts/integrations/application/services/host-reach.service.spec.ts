import type { TeamSecretsPort } from '@configuration/application/ports/team-secrets.port';
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

const integration = (connects: boolean) =>
  Integration.of({
    source: SourceKey.of('slack'),
    credentials: [SecretName.of('SLACK_BOT_TOKEN')],
    connects,
  });

const reaching = (token: string | null) => {
  const of = vi.fn(async () =>
    token
      ? ({ accessToken: AccessToken.of(token) } as unknown as HostConnection)
      : null,
  );

  return {
    reach: new HostReach(
      {
        resolveAll: async () => ({ SLACK_BOT_TOKEN: 'xoxb-1' }),
      } as unknown as TeamSecretsPort,
      { of } as unknown as HostConnectionRepository,
    ),
    of,
  };
};

describe('HostReach', () => {
  it('hands over the secrets an integration asks for', async () => {
    const { reach } = reaching(null);

    await expect(reach.of(TEAM, integration(false))).resolves.toEqual({
      secret: { SLACK_BOT_TOKEN: 'xoxb-1' },
      connection: null,
    });
  });

  it('hands over the token of a connection the team made', async () => {
    const { reach, of } = reaching('xoxp-2');

    const reached = await reach.of(TEAM, integration(true));

    expect(reached.connection?.value).toBe('xoxp-2');
    expect(of).toHaveBeenCalledWith(TEAM, SourceKey.of('slack'));
  });

  it('asks for no connection where the integration makes none', async () => {
    const { reach, of } = reaching('xoxp-2');

    await reach.of(TEAM, integration(false));

    expect(of).not.toHaveBeenCalled();
  });
});
