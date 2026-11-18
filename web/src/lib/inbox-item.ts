import type { ConversationItem, InboxItem, InboxItemView } from '@/lib/inbox';

export const stationOf = (item: InboxItem): ConversationItem['station'] => ({
  name: item.station,
  color: item.stationColor,
  position: item.stationPosition,
  count: item.stationCount,
});

export const suggestsClosing = (item: InboxItemView): boolean =>
  !item.resolved && item.notes.at(-1)?.suggestsClosing === true;

export const carriesItsOwn = (item: InboxItemView): boolean =>
  item.notes[0]?.form === 'setup';
