import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import {
  BOARD_VIEWS,
  type BoardView,
  storeBoardView,
  storedBoardView,
} from '@/lib/board';

export function useBoardView(): [BoardView, (next: BoardView) => void] {
  const [params, setParams] = useSearchParams();
  const inUrl = params.get('view');
  const view: BoardView = BOARD_VIEWS.some((each) => each.id === inUrl)
    ? (inUrl as BoardView)
    : storedBoardView();

  useEffect(() => {
    storeBoardView(view);
  }, [view]);

  return [view, (next) => setParams({ view: next })];
}
