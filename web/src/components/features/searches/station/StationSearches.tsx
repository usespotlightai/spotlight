import { StartSearchControl } from '@/components/features/searches/station/StartSearchControl';
import { StationSearchList } from '@/components/features/searches/station/StationSearchList';
import { PanelActions } from '@/components/shared/PanelActions';
import { useSearchStart } from '@/hooks/useSearchStart';
import type { ReplayedStation } from '@/lib/replay';

export function StationSearches({ at }: { at: ReplayedStation }) {
  const { searches, kept } = useSearchStart(at);
  const start = <StartSearchControl at={at} />;

  return (
    <>
      <StationSearchList
        at={at}
        searches={searches}
        set={kept.data}
        start={start}
      />
      {(searches.data ?? []).length > 0 && <PanelActions>{start}</PanelActions>}
    </>
  );
}
