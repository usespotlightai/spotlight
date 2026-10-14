import { OpenReplaySetButton } from '@/components/features/replays/station/OpenReplaySetButton';
import { PanelActions } from '@/components/shared/PanelActions';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import type { ReplayedStation } from '@/lib/replay';

export function OpenReplaySetAction({ at }: { at: ReplayedStation }) {
  const sets = useReplaySets(at.teamId, at.lineId, at.stationId);

  if ((sets.data ?? []).length === 0) {
    return null;
  }

  return (
    <PanelActions>
      <OpenReplaySetButton at={at} />
    </PanelActions>
  );
}
