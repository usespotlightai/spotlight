import {
  type Cursor,
  decodeCursor,
  isSortableTime,
} from '@platform/persistence/drizzle/keyset';
import { InvalidPageCursorError } from '@work/application/errors/invalid-page-cursor.error';

export const cursorOf = (
  before: string | null,
  fits: (key: string) => boolean = () => true,
): Cursor | null => {
  if (before === null) {
    return null;
  }

  const cursor = decodeCursor(before);

  if (!cursor || !fits(cursor.key)) {
    throw new InvalidPageCursorError();
  }

  return cursor;
};

export const timeCursorOf = (before: string | null): Cursor | null =>
  cursorOf(before, isSortableTime);
