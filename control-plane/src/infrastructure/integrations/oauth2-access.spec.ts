import { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import {
  compileIntegration,
  type ReadableIntegration,
} from '@infrastructure/integrations/integration.compile';
import { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const SLACK = SourceKey.of('slack');

const WITH_OAUTH = `
version: 1
integration: slack
connection:
  oauth2:
    authorize: https://slack.com/oauth/authorize
    token: https://slack.com/api/oauth.v2.access
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: '\${{ true }}'
      raise:
        happening: slack.app_mention
        marks:
          - kind: slack.thread
            value: '\${{ body.event.ts }}'
`;

const WITHOUT_OAUTH = WITH_OAUTH.replace(/connection:\n(?: {2}.*\n)+/, '');

const readable = (text: string): ReadableIntegration => {
  const read = compileIntegration('.spotlight/integrations/slack.yml', text);
  if (!read.ok) {
    throw new Error(read.problems.map((each) => each.reason).join(', '));
  }
  return read.readable;
};

const stored = () =>
  HostConnection.rehydrate({
    teamId: TEAM,
    source: SLACK,
    accessToken: 'xoxb-1',
    refreshToken: 'xoxe-1',
    expiresAt: null,
    scopes: ['chat:write'],
    handle: 'Acme',
  });

const access = (connection: HostConnection | null) => {
  const of = vi.fn(async () => connection);

  const it = new OAuth2Access({
    of,
    save: vi.fn(),
    held: vi.fn(),
    nearingExpiry: vi.fn(),
  } as unknown as HostConnectionRepository);

  return { it, of };
};

describe('OAuth2Access', () => {
  it('has no token where the host is not linked by connection', async () => {
    const { it, of } = access(null);

    expect(await it.token(TEAM, readable(WITHOUT_OAUTH))).toBeNull();
    expect(of).not.toHaveBeenCalled();
  });

  it('has no token where the team has not linked', async () => {
    const { it } = access(null);

    expect(await it.token(TEAM, readable(WITH_OAUTH))).toBeNull();
  });

  it('wears the token the connection holds', async () => {
    const { it } = access(stored());

    expect(await it.token(TEAM, readable(WITH_OAUTH))).toBe('xoxb-1');
  });

  it('only ever reads — it does not renew or write', async () => {
    const save = vi.fn();
    const it = new OAuth2Access({
      of: vi.fn(async () => stored()),
      save,
      held: vi.fn(),
      nearingExpiry: vi.fn(),
    } as unknown as HostConnectionRepository);

    await it.token(TEAM, readable(WITH_OAUTH));

    expect(save).not.toHaveBeenCalled();
  });
});
