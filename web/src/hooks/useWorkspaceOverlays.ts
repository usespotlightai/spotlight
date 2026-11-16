import { useState } from 'react';

import { useWorkspaceCommands } from '@/hooks/useWorkspaceCommands';
import type { PalettePick } from '@/lib/commands/targets';
import type { Team } from '@/lib/team';

const NO_TEAMS: readonly Team[] = [];

export function useWorkspaceOverlays(
  slug: string | undefined,
  teams: readonly Team[] = NO_TEAMS,
) {
  const [searching, setSearching] = useState(false);
  const [pick, setPick] = useState<PalettePick | undefined>();
  const [showingShortcuts, setShowingShortcuts] = useState(false);
  const search = (wanted?: PalettePick) => {
    setPick(wanted);
    setSearching(true);
  };

  useWorkspaceCommands({
    slug: slug ?? '',
    teams,
    onPalette: search,
    onTogglePalette: () => {
      setPick(undefined);
      setSearching((open) => !open);
    },
    onShortcuts: () => setShowingShortcuts(true),
  });

  return {
    search,
    palette: { open: searching, pick, onOpenChange: setSearching },
    sheet: { open: showingShortcuts, onOpenChange: setShowingShortcuts },
  };
}
