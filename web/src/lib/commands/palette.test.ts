import { describe, expect, it } from 'vitest';

import { paletteActions } from '@/lib/commands/palette';
import { activeCommands, type Registered } from '@/lib/commands/registry';
import type { ShortcutId } from '@/lib/commands/shortcuts';

const registered = (ids: readonly ShortcutId[]): Registered[] =>
  activeCommands(
    ids.map((id, order) => ({ id, run: () => {}, depth: 0, order })),
  );

describe('paletteActions', () => {
  it('lists the actions on the selection before every other action', () => {
    expect(
      paletteActions(
        registered([
          'shortcuts.show',
          'sidebar.toggle',
          'list.clear',
          'task.create',
          'task.backlog',
          'task.complete',
        ]),
      ).map((each) => each.id),
    ).toEqual([
      'task.backlog',
      'task.complete',
      'shortcuts.show',
      'sidebar.toggle',
      'list.clear',
      'task.create',
    ]);
  });
});
