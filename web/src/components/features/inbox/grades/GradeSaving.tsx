import { formatDay, type Grade, SAVING_GRADE } from '@/lib/judge';

type GradeSavingProps = {
  pending: boolean;
  mine: Grade | null;
};

export function GradeSaving({ pending, mine }: GradeSavingProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-slot="grade-saving"
      className="shrink-0 text-muted-foreground text-xs tabular-nums empty:hidden"
    >
      {pending ? SAVING_GRADE : mine ? formatDay(mine.at.slice(0, 10)) : null}
    </span>
  );
}
