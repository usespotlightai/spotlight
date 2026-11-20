import { describe, expect, it } from 'vitest';

import { formatDate } from '@/lib/date-format';

const at = new Date('2025-03-07T16:05:09Z');

describe('formatDate', () => {
  it('gives the text of toLocaleDateString', () => {
    for (const options of [
      { month: 'short', day: 'numeric' },
      { month: 'short', day: 'numeric', year: 'numeric' },
      { month: 'short', day: 'numeric', timeZone: 'UTC' },
      { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
    ] as const) {
      expect(formatDate(at, options)).toBe(
        at.toLocaleDateString(undefined, options),
      );
    }
  });

  it('gives the text of toLocaleTimeString', () => {
    for (const options of [
      { hour: 'numeric', minute: '2-digit' },
      { hour: '2-digit', minute: '2-digit' },
    ] as const) {
      expect(formatDate(at, options)).toBe(
        at.toLocaleTimeString(undefined, options),
      );
    }
  });

  it('gives the text of toLocaleString', () => {
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    } as const;

    expect(formatDate(at, options)).toBe(at.toLocaleString(undefined, options));
  });
});
