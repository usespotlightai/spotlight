import { describe, expect, it } from 'vitest';

import { grants } from './permissions';

const ORIGIN = 'https://app.usespotlight.ai';

describe('grants', () => {
  it.each(['notifications', 'clipboard-sanitized-write'])(
    'grants %s to the app',
    (permission) => {
      expect(grants(permission, `${ORIGIN}/w/acme`, ORIGIN)).toBe(true);
      expect(grants(permission, ORIGIN, ORIGIN)).toBe(true);
    },
  );

  it.each(['clipboard-read', 'media', 'geolocation', 'openExternal'])(
    'refuses %s',
    (permission) => {
      expect(grants(permission, `${ORIGIN}/w/acme`, ORIGIN)).toBe(false);
    },
  );

  it('refuses another origin', () => {
    expect(
      grants('clipboard-sanitized-write', 'https://github.com/login', ORIGIN),
    ).toBe(false);
  });
});
