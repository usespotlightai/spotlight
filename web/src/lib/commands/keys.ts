export type Chord = string;

export type Keys = readonly Chord[];

export const SEQUENCE_MS = 1000;

const NAMED_KEYS: Record<string, string> = {
  Escape: 'escape',
  Enter: 'enter',
  Backspace: 'backspace',
  Delete: 'delete',
  Tab: 'tab',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ' ': 'space',
};

const LETTER = /^[a-z]$/;

export const chordOf = (event: KeyboardEvent): Chord | null => {
  const named = NAMED_KEYS[event.key];
  const key =
    named ?? (event.key.length === 1 ? event.key.toLowerCase() : null);

  if (!key) {
    return null;
  }

  return [
    (event.metaKey || event.ctrlKey) && 'mod',
    event.altKey && 'alt',
    event.shiftKey && (named || LETTER.test(key)) && 'shift',
    key,
  ]
    .filter(Boolean)
    .join('+');
};

export const startsWith = (keys: Keys, pressed: Keys): boolean =>
  pressed.length <= keys.length &&
  pressed.every((chord, at) => keys[at] === chord);

export const onMac = (): boolean =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

const MAC_CAPS: Record<string, string> = {
  mod: '⌘',
  alt: '⌥',
  shift: '⇧',
  backspace: '⌫',
};

const OTHER_CAPS: Record<string, string> = {
  mod: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  backspace: 'Backspace',
};

const SHARED_CAPS: Record<string, string> = {
  ctrl: 'Ctrl',
  enter: 'Enter',
  escape: 'Esc',
  delete: 'Del',
  tab: 'Tab',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  space: 'Space',
};

const capOf = (part: string, mac: boolean): string =>
  (mac ? MAC_CAPS : OTHER_CAPS)[part] ??
  SHARED_CAPS[part] ??
  part.toUpperCase();

export const capsOf = (chord: Chord, mac: boolean): string[] =>
  chord.split('+').map((part) => capOf(part, mac));

const MAC_NAMES: Record<string, string> = {
  mod: 'Command',
  alt: 'Option',
};

const OTHER_NAMES: Record<string, string> = {
  mod: 'Control',
  alt: 'Alt',
};

const SHARED_NAMES: Record<string, string> = {
  ctrl: 'Control',
  shift: 'Shift',
  enter: 'Enter',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  tab: 'Tab',
  up: 'Up arrow',
  down: 'Down arrow',
  left: 'Left arrow',
  right: 'Right arrow',
  space: 'Space',
  '/': 'Slash',
  '?': 'Question mark',
  '[': 'Left bracket',
  ']': 'Right bracket',
  ',': 'Comma',
};

const nameOf = (part: string, mac: boolean): string =>
  (mac ? MAC_NAMES : OTHER_NAMES)[part] ??
  SHARED_NAMES[part] ??
  part.toUpperCase();

export const spokenOf = (keys: Keys, mac: boolean): string =>
  keys
    .map((chord) =>
      chord
        .split('+')
        .map((part) => nameOf(part, mac))
        .join(' '),
    )
    .join(', then ');
