import { type Keys, startsWith } from '@/lib/commands/keys';
import {
  SHORTCUT_IDS,
  type ShortcutId,
  shortcutOf,
} from '@/lib/commands/shortcuts';

export type Command = {
  readonly id: ShortcutId;
  readonly run: () => void;
  readonly title?: string;
  readonly to?: string;
  readonly enabled?: () => boolean;
};

export type Registered = Command & {
  readonly depth: number;
  readonly order: number;
};

export type Match =
  | { readonly kind: 'run'; readonly command: Registered }
  | { readonly kind: 'wait' }
  | { readonly kind: 'none' };

const usable = (command: Registered) => command.enabled?.() ?? true;

const stronger = (left: Registered, right: Registered) =>
  left.depth !== right.depth
    ? left.depth > right.depth
    : left.order > right.order;

const strongestOf = (
  entries: readonly Registered[],
  id: ShortcutId,
): Registered | null => {
  let found: Registered | null = null;

  for (const command of entries) {
    if (
      command.id === id &&
      usable(command) &&
      (!found || stronger(command, found))
    ) {
      found = command;
    }
  }

  return found;
};

export const activeCommands = (entries: readonly Registered[]): Registered[] =>
  SHORTCUT_IDS.map((id) => strongestOf(entries, id)).filter(
    (command): command is Registered => command !== null,
  );

export class CommandRegistry {
  readonly #entries = new Map<symbol, Registered>();
  readonly #listeners = new Set<() => void>();
  #snapshot: readonly Registered[] = [];
  #order = 0;

  add(command: Command, depth: number): () => void {
    const key = Symbol(command.id);
    this.#order += 1;
    this.#entries.set(key, { ...command, depth, order: this.#order });
    this.#changed();

    return () => {
      this.#entries.delete(key);
      this.#changed();
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  };

  snapshot = (): readonly Registered[] => this.#snapshot;

  match(pressed: Keys, typing: boolean): Match {
    const fitting = activeCommands(this.#snapshot).filter((command) => {
      const shortcut = shortcutOf(command.id);

      return (
        shortcut.focused !== true &&
        (!typing || shortcut.typing === true) &&
        startsWith(shortcut.keys, pressed)
      );
    });
    const exact = fitting.find(
      (command) => shortcutOf(command.id).keys.length === pressed.length,
    );

    if (exact) {
      return { kind: 'run', command: exact };
    }

    return fitting.length > 0 ? { kind: 'wait' } : { kind: 'none' };
  }

  #changed() {
    this.#snapshot = [...this.#entries.values()];
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
