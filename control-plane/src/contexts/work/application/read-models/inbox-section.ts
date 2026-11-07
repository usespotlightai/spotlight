export const INBOX_SECTIONS = ['open', 'running', 'resolved'] as const;

export type InboxSection = (typeof INBOX_SECTIONS)[number];

export const inboxSectionOf = (entry: {
  readonly unread: boolean;
  readonly resolved: boolean;
  readonly running: boolean;
}): InboxSection => {
  if (entry.unread) {
    return 'open';
  }
  if (entry.resolved) {
    return 'resolved';
  }

  return entry.running ? 'running' : 'open';
};
