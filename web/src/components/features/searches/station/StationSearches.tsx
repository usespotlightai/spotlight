import { StartSearchControl } from '@/components/features/searches/station/StartSearchControl';
import { StationSearchList } from '@/components/features/searches/station/StationSearchList';
import { PanelActions } from '@/components/shared/PanelActions';
import { useSearchStart } from '@/hooks/useSearchStart';
import type { ReplayedStation } from '@/lib/replay';

export function StationSearches({ at }: { at: ReplayedStation }) {
  const { searches, sets } = useSearchStart(at);
  const start = <StartSearchControl at={at} />;

  return (
    <>
      <StationSearchList
        at={at}
        searches={searches}
        sets={sets.data}
        start={start}
      />
      {(searches.data ?? []).length > 0 && <PanelActions>{start}</PanelActions>}
    </>
  );
}
