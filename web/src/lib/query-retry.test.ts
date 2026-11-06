import { describe, expect, it } from 'vitest';
import { retryQuery } from '@/lib/query-retry';

const failed = (status: number | null) => ({
  sentRequest: { method: 'GET', path: '/api/workspaces', status },
});

describe('retryQuery', () => {
  it.each([502, 503, null])(
    'keeps retrying while the control plane answers %s, as during a deploy',
    (status) => {
      expect(retryQuery(4, failed(status))).toBe(true);
      expect(retryQuery(5, failed(status))).toBe(false);
    },
  );

  it.each([500, 504])('retries a %s once', (status) => {
    expect(retryQuery(0, failed(status))).toBe(true);
    expect(retryQuery(1, failed(status))).toBe(false);
  });

  it('retries a failure without a request once', () => {
    expect(retryQuery(1, new Error('render failed'))).toBe(false);
  });
});
