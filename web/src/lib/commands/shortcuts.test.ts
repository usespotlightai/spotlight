import { describe, expect, it } from 'vitest';

import { startsWith } from '@/lib/commands/keys';
import {
  DESKTOP_CHORDS,
  SHORTCUT_IDS,
  shortcutOf,
} from '@/lib/commands/shortcuts';

const runByListener = SHORTCUT_IDS.filter((id) => !shortcutOf(id).focused);

const pairs = runByListener.flatMap((left, at) =>
  runByListener.slice(at + 1).map((right) => [left, right] as const),
);

describe('SHORTCUTS', () => {
  it.each(pairs)(
    'gives %s and %s keys that neither equal nor start each other',
    (left, right) => {
      const one = shortcutOf(left).keys;
      const other = shortcutOf(right).keys;

      expect(startsWith(one, other) || startsWith(other, one)).toBe(false);
    },
  );

  it.each(SHORTCUT_IDS)('leaves the desktop app keys to the app: %s', (id) => {
    for (const chord of shortcutOf(id).keys) {
      expect(DESKTOP_CHORDS).not.toContain(chord);
    }
  });

  it.each(SHORTCUT_IDS.filter((id) => shortcutOf(id).typing === true))(
    'keeps single keys without a modifier out of text fields: %s',
    (id) => {
      expect(
        shortcutOf(id).keys.every((chord) => chord.startsWith('mod+')),
      ).toBe(true);
    },
  );
});
