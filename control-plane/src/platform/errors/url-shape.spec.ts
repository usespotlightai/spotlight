import { originOf, urlShape } from '@platform/errors/url-shape';
import { describe, expect, it } from 'vitest';

describe('urlShape', () => {
  it('keeps the route of a URL and names every id or token :id', () => {
    expect(
      urlShape(
        'https://app.example/api/invites/Zx81kQ_secret-token/accept?a=b',
      ),
    ).toBe('https://app.example/api/invites/:id/accept');
    expect(urlShape('/api/teams/team_123/replay-checks/check-9')).toBe(
      '/api/teams/:id/replay-checks/:id',
    );
  });

  it('keeps only the origin of a call that Spotlight makes', () => {
    expect(originOf('https://hooks.slack.com/services/T0/B0/secret')).toBe(
      'https://hooks.slack.com',
    );
  });
});
