import type { Keys } from '@/lib/commands/keys';

export const SHORTCUT_GROUPS = [
  'General',
  'Navigation',
  'Lists',
  'Tasks',
  'Inbox',
] as const;

type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

export type Shortcut = {
  readonly title: string;
  readonly group: ShortcutGroup;
  readonly keys: Keys;
  readonly typing?: boolean;
  readonly focused?: boolean;
  readonly inPalette?: boolean;
};

const SHORTCUTS = {
  'palette.open': {
    title: 'Open the command palette',
    group: 'General',
    keys: ['mod+k'],
    typing: true,
    inPalette: false,
  },
  search: { title: 'Search', group: 'General', keys: ['/'], inPalette: false },
  'shortcuts.show': {
    title: 'Show keyboard shortcuts',
    group: 'General',
    keys: ['?'],
  },
  'sidebar.toggle': {
    title: 'Show or hide the sidebar',
    group: 'General',
    keys: ['['],
  },
  'go.inbox': { title: 'Go to Inbox', group: 'Navigation', keys: ['g', 'i'] },
  'go.agent': { title: 'Go to Agent', group: 'Navigation', keys: ['g', 'a'] },
  'go.runs': { title: 'Go to Runs', group: 'Navigation', keys: ['g', 'r'] },
  'go.insights': {
    title: 'Go to Insights',
    group: 'Navigation',
    keys: ['g', 'n'],
  },
  'go.memory': { title: 'Go to Memory', group: 'Navigation', keys: ['g', 'm'] },
  'go.lines': { title: 'Go to a line', group: 'Navigation', keys: ['g', 'l'] },
  'go.settings': {
    title: 'Go to settings',
    group: 'Navigation',
    keys: ['g', 's'],
  },
  'open.line': { title: 'Open a line', group: 'Navigation', keys: ['o', 'l'] },
  'open.station': {
    title: 'Open a station',
    group: 'Navigation',
    keys: ['o', 's'],
  },
  'open.task': { title: 'Open a task', group: 'Navigation', keys: ['o', 't'] },
  'list.next': {
    title: 'Move down',
    group: 'Lists',
    keys: ['j'],
    inPalette: false,
  },
  'list.previous': {
    title: 'Move up',
    group: 'Lists',
    keys: ['k'],
    inPalette: false,
  },
  'list.open': {
    title: 'Open the focused item',
    group: 'Lists',
    keys: ['enter'],
    focused: true,
  },
  'list.select': {
    title: 'Select the focused item',
    group: 'Lists',
    keys: ['x'],
    inPalette: false,
  },
  'list.clear': {
    title: 'Clear the selection',
    group: 'Lists',
    keys: ['escape'],
  },
  'task.create': { title: 'Create a task', group: 'Tasks', keys: ['c'] },
  'task.station': {
    title: 'Move to a station',
    group: 'Tasks',
    keys: ['s'],
  },
  'task.assign': { title: 'Assign', group: 'Tasks', keys: ['a'] },
  'task.take-over': {
    title: 'Take over the task',
    group: 'Tasks',
    keys: ['shift+t'],
  },
  'task.hand-back': {
    title: 'Hand the task back to the line',
    group: 'Tasks',
    keys: ['shift+h'],
  },
  'task.delete': {
    title: 'Delete the task',
    group: 'Tasks',
    keys: ['mod+backspace'],
  },
  'inbox.resolve': { title: 'Resolve', group: 'Inbox', keys: ['e'] },
  'inbox.reply': { title: 'Reply', group: 'Inbox', keys: ['r'] },
  'approval.approve': {
    title: 'Approve the focused card',
    group: 'Inbox',
    keys: ['mod+enter'],
    typing: true,
  },
} as const satisfies Record<string, Shortcut>;

export type ShortcutId = keyof typeof SHORTCUTS;

export const shortcutOf = (id: ShortcutId): Shortcut => SHORTCUTS[id];

export const SHORTCUT_IDS = Object.keys(SHORTCUTS) as ShortcutId[];

export type DesktopShortcut = {
  readonly title: string;
  readonly keys: Keys;
};

export const DESKTOP_SHORTCUTS: readonly DesktopShortcut[] = [
  { title: 'New tab', keys: ['mod+t'] },
  { title: 'New window', keys: ['mod+n'] },
  { title: 'Close the tab', keys: ['mod+w'] },
  { title: 'Show the next tab', keys: ['ctrl+tab'] },
  { title: 'Show the previous tab', keys: ['ctrl+shift+tab'] },
  { title: 'Show tab 1 to 8', keys: ['mod+1–8'] },
  { title: 'Show the last tab', keys: ['mod+9'] },
  { title: 'Go back', keys: ['mod+['] },
  { title: 'Go forward', keys: ['mod+]'] },
  { title: 'Open settings', keys: ['mod+,'] },
];

export const DESKTOP_CHORDS = [
  'mod+t',
  'mod+n',
  'mod+w',
  'mod+shift+[',
  'mod+shift+]',
  'mod+[',
  'mod+]',
  'mod+,',
  ...Array.from({ length: 9 }, (_, at) => `mod+${at + 1}`),
];
