export const BOARD_VIEWS = [
  { id: 'active', label: 'Active' },
  { id: 'backlog', label: 'Backlog' },
] as const;

export type BoardView = (typeof BOARD_VIEWS)[number]['id'];

export const FALLBACK_BOARD_VIEW: BoardView = 'active';

export const asBoardView = (raw: string | null): BoardView =>
  BOARD_VIEWS.some((view) => view.id === raw)
    ? (raw as BoardView)
    : FALLBACK_BOARD_VIEW;

export const inView = (view: BoardView, place: number): boolean =>
  view === 'backlog' ? place === 0 : place > 0;
