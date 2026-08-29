import type { InboxItemResponseDto } from '@/lib/api';

export type InboxItem = InboxItemResponseDto;

export const inboxPath = (slug: string) => `/w/${slug}/inbox`;

export const inboxItemPath = (slug: string, taskId: string) =>
  `${inboxPath(slug)}/${taskId}`;

/** What the task is waiting on: the last thing anything said about it. */
export const waitingOn = (item: InboxItem) => item.notes[item.notes.length - 1];
