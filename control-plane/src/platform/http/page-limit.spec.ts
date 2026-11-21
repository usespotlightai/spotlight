import { BadRequestException } from '@nestjs/common';
import { pageLimitOf } from '@platform/http/page-limit';
import {
  LONGEST_PAGE,
  PAGE_LIMIT,
} from '@shared-kernel/application/dto/page.dto';
import { describe, expect, it } from 'vitest';

describe('pageLimitOf', () => {
  it('gives the default page limit when the request names none', () => {
    expect(pageLimitOf(undefined)).toBe(PAGE_LIMIT);
  });

  it.each([
    ['1', 1],
    ['25', 25],
    [String(LONGEST_PAGE), LONGEST_PAGE],
  ])('takes the limit %s', (raw, limit) => {
    expect(pageLimitOf(raw)).toBe(limit);
  });

  it('keeps a page to the longest page', () => {
    expect(pageLimitOf(String(LONGEST_PAGE + 1))).toBe(LONGEST_PAGE);
    expect(pageLimitOf('100000')).toBe(LONGEST_PAGE);
  });

  it.each(['0', '-1', '2.5', 'ten', '', ' ', '1e2', '0x10', '+5', ' 25 '])(
    'refuses %j as a page limit',
    (raw) => {
      expect(() => pageLimitOf(raw)).toThrow(
        new BadRequestException(
          'Sorry, the page limit must be a whole number above 0.',
        ),
      );
    },
  );
});
