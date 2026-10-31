import { calendarPage } from '@/lib/calendar';
import { cn } from '@/lib/utils';

type CalendarDayProps = {
  day: string;
  className?: string;
};

export function CalendarDay({ day, className }: CalendarDayProps) {
  const page = calendarPage(day);

  return (
    <span
      role="img"
      aria-label={page.label}
      data-slot="calendar-day"
      className={cn(
        'flex size-24 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[1.35rem] border border-border bg-card shadow-xs',
        className,
      )}
    >
      <span className="font-semibold text-[1.2rem] text-destructive leading-none tracking-wide">
        {page.month}
      </span>
      <span className="font-light text-[2.85rem] text-foreground tabular-nums leading-none tracking-normal">
        {page.day}
      </span>
    </span>
  );
}
