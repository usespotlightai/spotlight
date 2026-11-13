import type { UniqueIdentifier } from '@dnd-kit/core';
import { createContext } from 'react';

import type { SplitSide } from '@/lib/app-tabs';

const ZONE_PREFIX = 'split-zone:';

export const zoneId = (side: SplitSide) => `${ZONE_PREFIX}${side}`;

export const sideOf = (id: UniqueIdentifier): SplitSide | null => {
  const text = String(id);

  if (text === zoneId('left')) {
    return 'left';
  }

  return text === zoneId('right') ? 'right' : null;
};

type TabDragState = {
  readonly draggedId: string | null;
  readonly overSide: SplitSide | null;
  readonly accepts: (side: SplitSide) => boolean;
};

export const TabDragContext = createContext<TabDragState>({
  draggedId: null,
  overSide: null,
  accepts: () => false,
});
