import { BadRequestException } from '@nestjs/common';
import { LONGEST_PAGE, PAGE_LIMIT } from '@work/application/dto/page.dto';
import { pageRequestOf } from '@work/presentation/http/paging';
import { describe, expect, it } from 'vitest';

describe('a page request read from the query string', () => {
  it('starts at the first page with the default limit', () => {
    expect(pageRequestOf(undefined, undefined)).toEqual({
      before: null,
      limit: PAGE_LIMIT,
    });
  });

  it('passes the cursor on as it came', () => {
    expect(pageRequestOf('opaque', '10')).toEqual({
      before: 'opaque',
      limit: 10,
    });
  });

  it('caps the limit at the longest page', () => {
    expect(pageRequestOf(undefined, '5000').limit).toBe(LONGEST_PAGE);
  });

  it('refuses a limit that is not a whole number above 0', () => {
    expect(() => pageRequestOf(undefined, '0')).toThrow(BadRequestException);
    expect(() => pageRequestOf(undefined, '2.5')).toThrow(BadRequestException);
  });
});
