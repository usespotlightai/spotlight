import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import {
  BOARD_VIEWS,
  type BoardView,
  storeBoardView,
  storedBoardView,
} from '@/lib/board';
import { nonEmpty } from '@/lib/non-empty';

export function useBoardView(
  lineId: string | undefined,
): [BoardView, (next: BoardView) => void] {
  const [params, setParams] = useSearchParams();
  const inUrl = params.get('view');
  const view: BoardView =
    BOARD_VIEWS.find((each) => each.id === inUrl)?.id ??
    storedBoardView(lineId ?? '');

  useEffect(() => {
    if (nonEmpty(lineId)) {
      storeBoardView(lineId, view);
    }
  }, [lineId, view]);

  return [view, (next) => setParams({ view: next })];
}
