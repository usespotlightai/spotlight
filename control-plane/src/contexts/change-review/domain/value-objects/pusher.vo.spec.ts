import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { describe, expect, it } from 'vitest';

describe('Pusher', () => {
  it('keeps the login without the space around it', () => {
    expect(Pusher.of('  octocat ')?.value).toBe('octocat');
  });

  it('takes a blank login, or none, as no pusher', () => {
    expect(Pusher.of('   ')).toBeNull();
    expect(Pusher.of(null)).toBeNull();
  });

  it('is the same pusher for the same login', () => {
    const octocat = Pusher.of('octocat');

    expect(octocat && Pusher.of(' octocat ')?.equals(octocat)).toBe(true);
    expect(octocat && Pusher.of('hubot')?.equals(octocat)).toBe(false);
  });
});
