import { describe, expect, it } from 'vitest';

import { shortFingerprint } from '@/lib/station-config';

describe('shortFingerprint', () => {
  it('keeps the first eight characters', () => {
    expect(shortFingerprint('3f2a9c1e5b7d4a60c8e2')).toBe('3f2a9c1e');
  });
});
