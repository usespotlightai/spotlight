import { JoseWorkloadTokens } from '@platform/workload/jose-workload-tokens';
import {
  openWorkloadIssuer,
  type WorkloadIssuer,
} from '@platform/workload/workload-issuer.fake-spec';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const SUBJECT = 'system:serviceaccount:spotlight:runner';

const quiet: LoggerPort = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('JoseWorkloadTokens', () => {
  let platform: WorkloadIssuer;
  let tokens: JoseWorkloadTokens;
  let refusing = false;

  const expected = () => ({ issuer: platform.issuer, audience: 'spotlight' });

  beforeAll(async () => {
    platform = await openWorkloadIssuer();
    tokens = new JoseWorkloadTokens(quiet, globalThis.fetch, (url) => {
      if (refusing && new URL(url).hostname === '127.0.0.1') {
        throw new Error('Host is not on the allowed list.');
      }
    });
  });

  afterAll(async () => {
    await platform.close();
  });

  it('returns the claims of a token its issuer signed, finding the keys by discovery', async () => {
    const token = await platform.issue({
      sub: SUBJECT,
      aud: 'spotlight',
      repository: 'acme/platform',
      run_attempt: 2,
      jti: 'once',
    });

    await expect(tokens.verify(token, expected())).resolves.toEqual({
      issuer: platform.issuer,
      subject: SUBJECT,
      audiences: ['spotlight'],
      customClaims: { repository: 'acme/platform' },
    });
  });

  it('checks the cached issuer and key URLs again before it trusts its cached keys', async () => {
    const token = await platform.issue({ sub: SUBJECT, aud: 'spotlight' });

    await expect(tokens.verify(token, expected())).resolves.not.toBeNull();

    refusing = true;

    try {
      await expect(tokens.verify(token, expected())).resolves.toBeNull();
    } finally {
      refusing = false;
    }
  });

  it('rejects a token signed with any other key', async () => {
    const token = await platform.forge({ sub: SUBJECT, aud: 'spotlight' });

    await expect(tokens.verify(token, expected())).resolves.toBeNull();
  });

  it('rejects a token issued for another audience', async () => {
    const token = await platform.issue({ sub: SUBJECT, aud: 'vault' });

    await expect(tokens.verify(token, expected())).resolves.toBeNull();
  });

  it('rejects a token that has expired', async () => {
    const token = await platform.issue(
      { sub: SUBJECT, aud: 'spotlight' },
      '-5m',
    );

    await expect(tokens.verify(token, expected())).resolves.toBeNull();
  });

  it('rejects a token when the issuer cannot be discovered', async () => {
    const token = await platform.issue({ sub: SUBJECT, aud: 'spotlight' });

    await expect(
      tokens.verify(token, {
        issuer: 'http://127.0.0.1:1',
        audience: 'spotlight',
      }),
    ).resolves.toBeNull();
  });

  it('rejects what is not a token at all', async () => {
    await expect(tokens.verify('nonsense', expected())).resolves.toBeNull();
  });
});
