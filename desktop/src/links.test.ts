import { describe, expect, it } from 'vitest';

import { deepLinkIn, navigationOf, originOf, pageOf } from './links';

const ORIGIN = 'https://app.usespotlight.ai';

describe('originOf', () => {
  it.each([
    ['https://app.usespotlight.ai/w/acme', 'https://app.usespotlight.ai'],
    [' https://spotlight.example.com ', 'https://spotlight.example.com'],
    ['http://localhost:5173', 'http://localhost:5173'],
  ])('takes the origin of %s', (address, origin) => {
    expect(originOf(address)).toBe(origin);
  });

  it.each([
    'http://spotlight.example.com',
    'https://user:pass@spotlight.example.com',
    'file:///etc/passwd',
    'spotlight.example.com',
    '',
  ])('refuses %s', (address) => {
    expect(originOf(address)).toBeNull();
  });
});

describe('navigationOf', () => {
  it('keeps the Spotlight address in the window', () => {
    expect(navigationOf(`${ORIGIN}/w/acme/inbox`, ORIGIN)).toBe('inside');
  });

  it('keeps GitHub sign-in in the window, so that the session lands in the app', () => {
    expect(
      navigationOf('https://github.com/login/oauth/authorize?x=1', ORIGIN),
    ).toBe('sign-in');
    expect(navigationOf('https://github.com/login', ORIGIN)).toBe('sign-in');
    expect(
      navigationOf('https://github.com/sessions/two-factor/app', ORIGIN),
    ).toBe('sign-in');
  });

  it('does not take a GitHub profile that starts like a sign-in path for sign-in', () => {
    expect(navigationOf('https://github.com/loginfoo', ORIGIN)).toBe('outside');
  });

  it('opens an editor link in the editor', () => {
    expect(
      navigationOf('vscode://vscode-remote/ssh-remote+run/workspace', ORIGIN),
    ).toBe('outside');
    expect(navigationOf('cursor://vscode-remote/x', ORIGIN)).toBe('outside');
  });

  it('opens any other page in the browser', () => {
    expect(navigationOf('https://github.com/acme/api/pull/12', ORIGIN)).toBe(
      'outside',
    );
    expect(navigationOf('https://docs.usespotlight.ai', ORIGIN)).toBe(
      'outside',
    );
    expect(navigationOf('mailto:ops@example.com', ORIGIN)).toBe('outside');
  });

  it('opens nothing for other schemes', () => {
    expect(navigationOf('file:///etc/passwd', ORIGIN)).toBe('blocked');
    expect(navigationOf('javascript:alert(1)', ORIGIN)).toBe('blocked');
  });
});

describe('pageOf', () => {
  it('opens the same page of the Spotlight address', () => {
    expect(
      pageOf('spotlight://open/w/acme/inbox/task_1%3A0?tab=notes', ORIGIN),
    ).toBe(`${ORIGIN}/w/acme/inbox/task_1%3A0?tab=notes`);
  });

  it.each([
    'spotlight://open//evil.example.com/x',
    'spotlight://evil.example.com/w/acme',
    'https://app.usespotlight.ai/w/acme',
    'spotlight:open',
    'spotlight://open/api/auth/sign-out',
    'spotlight://open/device?user_code=ABCD',
  ])('opens nothing for %s', (link) => {
    expect(pageOf(link, ORIGIN)).toBeNull();
  });
});

describe('deepLinkIn', () => {
  it('finds the link that started a second instance', () => {
    expect(
      deepLinkIn(['/Applications/Spotlight.app', 'spotlight://open/w/acme']),
    ).toBe('spotlight://open/w/acme');
    expect(deepLinkIn(['/Applications/Spotlight.app'])).toBeNull();
  });
});
