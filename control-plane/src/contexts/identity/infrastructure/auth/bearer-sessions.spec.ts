import { bearerSessions } from '@identity/infrastructure/auth/bearer-sessions';
import { describe, expect, it } from 'vitest';

describe('bearerSessions', () => {
  it('reads a session from a bearer token', () => {
    expect(bearerSessions().hooks.before).toHaveLength(1);
  });

  it('never copies the session token into a response header that page scripts can read', () => {
    expect(bearerSessions().hooks).not.toHaveProperty('after');
  });
});
