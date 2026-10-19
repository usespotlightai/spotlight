import { loggablePath } from '@platform/http/loggable-path';
import { describe, expect, it } from 'vitest';

describe('loggablePath', () => {
  it('drops the query', () => {
    expect(loggablePath({ url: '/api/tasks?token=secret' })).toBe('/api/tasks');
  });

  it('names a token in the path by its parameter', () => {
    expect(
      loggablePath({
        url: '/api/invites/s3cr3t-token/accept?x=1',
        route: { path: '/api/invites/:token/accept' },
      }),
    ).toBe('/api/invites/:token/accept');
  });

  it('keeps ids, which logs may carry', () => {
    expect(
      loggablePath({
        url: '/api/teams/team-1/replay-checks/check-9',
        route: { path: '/api/teams/:teamId/replay-checks/:checkId' },
      }),
    ).toBe('/api/teams/team-1/replay-checks/check-9');
  });
});
