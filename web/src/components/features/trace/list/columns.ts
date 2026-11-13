export const TRACE_COLUMNS =
  'h-auto grid-cols-[1.25rem_minmax(0,7rem)_minmax(2.25rem,1fr)_auto] gap-x-2 gap-y-0.5 py-2 @2xl/pane:h-9 @2xl/pane:grid-cols-[1.25rem_7rem_6rem_minmax(0,1fr)_4rem_5rem_4.5rem] @2xl/pane:gap-x-3 @2xl/pane:py-0 @4xl/pane:grid-cols-[1.25rem_7rem_6rem_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_4rem_5rem_4.5rem]';

const WIDE = '@2xl/pane:col-auto @2xl/pane:row-auto';

export const TRACE_CELL = {
  select: `row-span-2 ${WIDE}`,
  started: `col-start-2 row-start-2 ${WIDE}`,
  stations: `col-start-3 row-start-2 ${WIDE}`,
  task: `col-span-2 col-start-2 row-start-1 ${WIDE}`,
  detail: 'hidden @4xl/pane:block',
  errors: 'hidden @2xl/pane:block',
  duration: `col-start-4 row-start-2 ${WIDE}`,
  cost: `col-start-4 row-start-1 ${WIDE}`,
} as const;

export const TRACE_HEAD_CELL = {
  ...TRACE_CELL,
  select: '',
  started: 'hidden @2xl/pane:block',
  stations: 'hidden @2xl/pane:block',
  duration: 'hidden @2xl/pane:block',
} as const;
