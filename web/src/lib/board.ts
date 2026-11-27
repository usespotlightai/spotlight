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

const boardViewKey = (lineId: string) => `spotlight.board-view.${lineId}`;

export const storedBoardView = (lineId: string): BoardView => {
  try {
    return asBoardView(localStorage.getItem(boardViewKey(lineId)));
  } catch {
    return FALLBACK_BOARD_VIEW;
  }
};

export const storeBoardView = (lineId: string, view: BoardView): void => {
  try {
    localStorage.setItem(boardViewKey(lineId), view);
  } catch {}
};

export const inView = (view: BoardView, kind: StationResponseDto['kind']) =>
  view === 'active' ? kind === 'work' : kind === view;
