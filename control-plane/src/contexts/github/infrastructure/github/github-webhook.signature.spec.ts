import { createHmac } from 'node:crypto';
import { GitHubWebhookSignature } from '@github/infrastructure/github/github-webhook.signature';
import { describe, expect, it } from 'vitest';

const SECRET = 'a shared secret';
const signing = new GitHubWebhookSignature({
  GITHUB_WEBHOOK_SECRET: SECRET,
} as never);

const body = Buffer.from('{"action":"closed"}');
const signed = (payload: Buffer, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

describe('GitHubWebhookSignature', () => {
  it('takes what GitHub signed with the shared secret', () => {
    expect(signing.signs(body, signed(body))).toBe(true);
  });

  it('refuses a body that changed after it was signed', () => {
    expect(
      signing.signs(Buffer.from('{"action":"opened"}'), signed(body)),
    ).toBe(false);
  });

  it('refuses a signature made with another secret', () => {
    expect(signing.signs(body, signed(body, 'someone else’s'))).toBe(false);
  });

  it('refuses a delivery that carries no signature at all', () => {
    expect(signing.signs(body, undefined)).toBe(false);
  });

  it('refuses everything where no secret was ever set', () => {
    const unset = new GitHubWebhookSignature({
      GITHUB_WEBHOOK_SECRET: '',
    } as never);

    expect(unset.signs(body, signed(body, ''))).toBe(false);
  });

  it('refuses a signature in an algorithm it does not know', () => {
    expect(signing.signs(body, 'sha1=deadbeef')).toBe(false);
  });
});
