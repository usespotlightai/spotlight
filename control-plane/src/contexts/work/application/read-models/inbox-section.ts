export const INBOX_SECTIONS = [
  'open',
  'running',
  'following',
  'resolved',
] as const;

export type InboxSection = (typeof INBOX_SECTIONS)[number];

export const inboxSectionOf = (entry: {
  readonly unread: boolean;
  readonly resolved: boolean;
  readonly running: boolean;
  readonly following: boolean;
}): InboxSection => {
  if (entry.following) {
    return 'following';
  }
  if (entry.unread) {
    return 'open';
  }
  if (entry.resolved) {
    return 'resolved';
  }

  return entry.running ? 'running' : 'open';
};
