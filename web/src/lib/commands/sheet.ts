import type { Keys } from '@/lib/commands/keys';
import {
  DESKTOP_SHORTCUTS,
  SHORTCUT_GROUPS,
  SHORTCUT_IDS,
  shortcutOf,
} from '@/lib/commands/shortcuts';

const DESKTOP_GROUP = 'Desktop app';

type ShortcutRow = {
  readonly title: string;
  readonly keys: Keys;
};

export type ShortcutSection = {
  readonly heading: string;
  readonly rows: readonly ShortcutRow[];
};

const matching = (query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  return (row: ShortcutRow) =>
    words.every((word) => row.title.toLowerCase().includes(word));
};

export const shortcutSections = (
  query: string,
  desktop: boolean,
): ShortcutSection[] => {
  const shown = matching(query);
  const grouped = SHORTCUT_GROUPS.map((heading) => ({
    heading,
    rows: SHORTCUT_IDS.map(shortcutOf).filter(
      (shortcut) => shortcut.group === heading,
    ),
  }));
  const sections = desktop
    ? [...grouped, { heading: DESKTOP_GROUP, rows: DESKTOP_SHORTCUTS }]
    : grouped;

  return sections
    .map((section) => ({ ...section, rows: section.rows.filter(shown) }))
    .filter((section) => section.rows.length > 0);
};
