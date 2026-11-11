import { encodeCursor } from '@platform/persistence/drizzle/keyset';
import { InvalidPageCursorError } from '@work/application/errors/invalid-page-cursor.error';
import {
  cursorOf,
  timeCursorOf,
} from '@work/infrastructure/persistence/drizzle/readers/page-cursor';
import { describe, expect, it } from 'vitest';

const TIME_CURSOR = encodeCursor({
  key: '2026-11-06T09:30:00.123456',
  id: 'run_1',
});

const RANK_CURSOR = encodeCursor({ key: 'a0', id: 'task_1' });

describe('the cursor a reader reads a page after', () => {
  it('reads from the start without a cursor', () => {
    expect(timeCursorOf(null)).toBeNull();
  });

  it('takes a cursor whose key the list sorts by', () => {
    expect(timeCursorOf(TIME_CURSOR)).toEqual({
      key: '2026-11-06T09:30:00.123456',
      id: 'run_1',
    });
    expect(cursorOf(RANK_CURSOR)).toEqual({ key: 'a0', id: 'task_1' });
  });

  it('refuses a cursor that does not decode', () => {
    expect(() => cursorOf('not-a-cursor')).toThrow(InvalidPageCursorError);
  });

  it('refuses a cursor from a list that sorts by another key', () => {
    expect(() => timeCursorOf(RANK_CURSOR)).toThrow(InvalidPageCursorError);
  });
});
