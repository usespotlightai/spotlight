import {
  type Cursor,
  decodeCursor,
  isSortableTime,
} from '@platform/persistence/drizzle/keyset';
import { InvalidPageCursorError } from '@shared-kernel/application/errors/invalid-page-cursor.error';

export const cursorOf = (
  raw: string | null,
  fits: (key: string) => boolean = () => true,
): Cursor | null => {
  if (raw === null) {
    return null;
  }

  const cursor = decodeCursor(raw);

  if (!cursor || !fits(cursor.key)) {
    throw new InvalidPageCursorError();
  }

  return cursor;
};

export const timeCursorOf = (raw: string | null): Cursor | null =>
  cursorOf(raw, isSortableTime);
