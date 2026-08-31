import type { StationResponseDto } from '@/lib/api';

export const BOARD_VIEWS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
] as const;

export type BoardView = (typeof BOARD_VIEWS)[number]['id'];

export const FALLBACK_BOARD_VIEW: BoardView = 'active';

export const asBoardView = (raw: string | null): BoardView =>
  BOARD_VIEWS.some((view) => view.id === raw)
    ? (raw as BoardView)
    : FALLBACK_BOARD_VIEW;

/** Each end of the line is a view of its own. */
export const inView = (view: BoardView, kind: StationResponseDto['kind']) =>
  view === 'active' ? kind === 'work' : kind === view;
