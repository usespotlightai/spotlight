import { type Runner, standing } from '@/lib/runner';
import { cn } from '@/lib/utils';

const dotOf = (runner: Runner) => {
  if (runner.revokedAt) {
    return 'bg-destructive/60';
  }
  return runner.connected ? 'bg-emerald-500' : 'bg-muted-foreground/40';
};

export function RunnerStanding({ runner }: { runner: Runner }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full font-medium text-muted-foreground text-xs">
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', dotOf(runner))}
      />
      {standing(runner)}
    </span>
  );
}
