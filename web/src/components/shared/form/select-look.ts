export const SELECT_TRIGGER =
  'flex min-w-0 items-center border border-border text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 data-[popup-open]:bg-accent';

export const FIELD_SELECT = {
  trigger: 'h-8 gap-2 rounded-md bg-card px-3 text-xs',
  menu: 'w-max min-w-[max(var(--anchor-width),12rem)] max-w-(--available-width)',
} as const;
