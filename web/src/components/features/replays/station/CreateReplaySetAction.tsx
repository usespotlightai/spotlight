import { CreateReplaySetButton } from '@/components/features/replays/station/CreateReplaySetButton';
import { PanelActions } from '@/components/shared/PanelActions';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import type { ReplayedStation } from '@/lib/replay';

export function CreateReplaySetAction({ at }: { at: ReplayedStation }) {
  const sets = useReplaySets(at.teamId, at.lineId, at.stationId);

  if ((sets.data ?? []).length === 0) {
    return null;
  }

  return (
    <PanelActions>
      <CreateReplaySetButton at={at} />
    </PanelActions>
  );
}
