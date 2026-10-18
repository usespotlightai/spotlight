import type { StationResponseDto } from '@/lib/api';

export const BOARD_VIEWS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
] as const;

export type BoardView = (typeof BOARD_VIEWS)[number]['id'];

const FALLBACK_BOARD_VIEW: BoardView = 'active';

export const asBoardView = (raw: string | null): BoardView =>
  BOARD_VIEWS.some((view) => view.id === raw)
    ? (raw as BoardView)
    : FALLBACK_BOARD_VIEW;

const BOARD_VIEW_STORAGE_KEY = 'spotlight.board-view';

export const storedBoardView = (): BoardView => {
  try {
    return asBoardView(localStorage.getItem(BOARD_VIEW_STORAGE_KEY));
  } catch {
    return FALLBACK_BOARD_VIEW;
  }
};

export const storeBoardView = (view: BoardView): void => {
  try {
    localStorage.setItem(BOARD_VIEW_STORAGE_KEY, view);
  } catch {}
};

export const inView = (view: BoardView, kind: StationResponseDto['kind']) =>
  view === 'active' ? kind === 'work' : kind === view;
