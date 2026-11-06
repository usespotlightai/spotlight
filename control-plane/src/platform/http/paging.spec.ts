import { BadRequestException } from '@nestjs/common';
import { pageRequestOf } from '@platform/http/paging';
import {
  encodeCursor,
  isTimeKey,
  LONGEST_PAGE,
  PAGE_LIMIT,
} from '@shared-kernel/application/dto/page.dto';
import { describe, expect, it } from 'vitest';

const TIME_CURSOR = encodeCursor({
  key: '2026-11-06T09:30:00.123456',
  id: 'run_1',
});

const RANK_CURSOR = encodeCursor({ key: 'a0', id: 'task_1' });

describe('a page request read from the query string', () => {
  it('starts at the first page with the default limit', () => {
    expect(pageRequestOf(undefined, undefined)).toEqual({
      before: null,
      limit: PAGE_LIMIT,
    });
  });

  it('caps the limit at the longest page', () => {
    expect(pageRequestOf(undefined, '5000').limit).toBe(LONGEST_PAGE);
  });

  it('takes a cursor whose key the list sorts by', () => {
    expect(pageRequestOf(TIME_CURSOR, '10', isTimeKey).before).toEqual({
      key: '2026-11-06T09:30:00.123456',
      id: 'run_1',
    });
  });

  it('refuses a cursor that does not decode', () => {
    expect(() => pageRequestOf('not-a-cursor', undefined)).toThrow(
      BadRequestException,
    );
  });

  it('refuses a cursor from a list that sorts by another key', () => {
    expect(() => pageRequestOf(RANK_CURSOR, undefined, isTimeKey)).toThrow(
      BadRequestException,
    );
  });

  it('refuses a limit that is not a whole number above 0', () => {
    expect(() => pageRequestOf(undefined, '0')).toThrow(BadRequestException);
    expect(() => pageRequestOf(undefined, '2.5')).toThrow(BadRequestException);
  });
});
