import type { ConversationItem, InboxItem } from '@/lib/inbox';

export const stationOf = (item: InboxItem): ConversationItem['station'] => ({
  name: item.station,
  color: item.stationColor,
  position: item.stationPosition,
  count: item.stationCount,
});

export const carriesItsOwn = (item: InboxItem): boolean =>
  item.notes[0]?.form === 'setup';
