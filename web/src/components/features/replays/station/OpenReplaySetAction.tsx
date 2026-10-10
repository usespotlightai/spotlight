import { OpenReplaySetButton } from '@/components/features/replays/station/OpenReplaySetButton';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import type { ReplayedStation } from '@/lib/replay';

export function OpenReplaySetAction({ at }: { at: ReplayedStation }) {
  const sets = useReplaySets(at.teamId, at.lineId, at.stationId);

  if ((sets.data ?? []).length === 0) {
    return null;
  }

  return (
    <div className="mt-auto flex justify-start pt-3">
      <OpenReplaySetButton at={at} />
    </div>
  );
}
