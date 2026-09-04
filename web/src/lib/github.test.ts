import { describe, expect, it } from 'vitest';
import {
  installUrlFor,
  somewhereHere,
  stateFor,
  whenceFrom,
} from '@/lib/github';

describe('github', () => {
  it('carries where a person came from through GitHub and back', () => {
    const whence = { slug: 'acme', teamId: 'team_1' };

    expect(whenceFrom(stateFor(whence))).toEqual(whence);
  });

  it('reads nothing out of a state it did not write', () => {
    expect(whenceFrom(null)).toBeNull();
    expect(whenceFrom('')).toBeNull();
    expect(whenceFrom('acme')).toBeNull();
    expect(whenceFrom('acme:team_1:one:two')).toBeNull();
  });

  it('hangs the state off the install URL GitHub gave it', () => {
    const url = installUrlFor(
      'https://github.com/apps/spotlight/installations/new',
      { slug: 'acme', teamId: 'team_1' },
    );

    expect(url).toBe(
      'https://github.com/apps/spotlight/installations/new?state=acme%3Ateam_1',
    );
  });

  it('carries the page they left, and hands it back', () => {
    const whence = {
      slug: 'acme',
      teamId: 'team_1',
      from: '/w/acme/inbox/i_1',
    };

    expect(whenceFrom(stateFor(whence))).toEqual(whence);
  });

  it('reads a state with no page in it', () => {
    expect(whenceFrom(stateFor({ slug: 'acme', teamId: 'team_1' }))).toEqual({
      slug: 'acme',
      teamId: 'team_1',
    });
  });

  // The state came back through GitHub, where anybody could have written it.
  it('refuses to hand back anywhere but a page of this site', () => {
    for (const away of [
      '//evil.example.com',
      'https://evil.example.com',
      'javascript:alert(1)',
      '/\\evil.example.com',
      'w/acme/inbox',
    ]) {
      const state = `acme:team_1:${encodeURIComponent(away)}`;

      expect(whenceFrom(state)).toEqual({ slug: 'acme', teamId: 'team_1' });
    }
  });

  it('knows a page of this site from somewhere else', () => {
    expect(somewhereHere('/w/acme/inbox')).toBe('/w/acme/inbox');
    expect(somewhereHere('//evil.example.com')).toBeNull();
    expect(somewhereHere('https://evil.example.com')).toBeNull();
    expect(somewhereHere(undefined)).toBeNull();
  });
});
