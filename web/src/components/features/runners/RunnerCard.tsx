import {
  HarnessPills,
  type NamedHarness,
} from '@/components/features/runners/HarnessPills';
import { type Runner, seenAt, standing } from '@/lib/runner';
import { cn } from '@/lib/utils';

type RunnerCardProps = {
  runner: Runner;
  harnesses: readonly NamedHarness[];
};

const dotOf = (runner: Runner) => {
  if (runner.revokedAt) {
    return 'bg-destructive/60';
  }
  return runner.connected ? 'bg-emerald-500' : 'bg-muted-foreground/40';
};

export function RunnerCard({ runner, harnesses }: RunnerCardProps) {
  return (
    <li className="flex min-h-36 flex-col justify-between gap-5 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate font-medium text-foreground text-sm">
            {runner.name}
          </h3>

          <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full font-medium text-muted-foreground text-xs">
            <span
              aria-hidden
              className={cn('size-1.5 shrink-0 rounded-full', dotOf(runner))}
            />
            {standing(runner)}
          </span>
        </div>

        <HarnessPills harnesses={harnesses} />
      </div>

      <p className="text-muted-foreground text-xs tabular-nums">
        {seenAt(runner)}
      </p>
    </li>
  );
}
