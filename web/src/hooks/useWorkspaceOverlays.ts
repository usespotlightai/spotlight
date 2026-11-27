import { useState, type Dispatch, type SetStateAction } from 'react';

import { useWorkspaceCommands } from '@/hooks/useWorkspaceCommands';
import type { PalettePick } from '@/lib/commands/targets';
import type { Team } from '@/lib/team';

const NO_TEAMS: readonly Team[] = [];

type WorkspaceOverlaysResult = {
  search: (wanted?: PalettePick) => void;
  palette: {
    open: boolean;
    pick: PalettePick | undefined;
    onOpenChange: Dispatch<SetStateAction<boolean>>;
  };
  sheet: { open: boolean; onOpenChange: Dispatch<SetStateAction<boolean>> };
};

export function useWorkspaceOverlays(
  slug: string | undefined,
  teams: readonly Team[] = NO_TEAMS,
): WorkspaceOverlaysResult {
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
