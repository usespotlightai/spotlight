import http from 'node:http';
import https from 'node:https';
import { captureException, flush, getClient } from '@sentry/nestjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('instrument', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('starts no Sentry client and opens no connection without a DSN', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    const requests = [
      vi.spyOn(http, 'request'),
      vi.spyOn(https, 'request'),
      vi.spyOn(globalThis, 'fetch'),
    ];

    await import('./instrument');
    captureException(new Error('nowhere to go'));
    await flush(100);

    expect(getClient()).toBeUndefined();
    for (const request of requests) {
      expect(request).not.toHaveBeenCalled();
    }
  });
});
