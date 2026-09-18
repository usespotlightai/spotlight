import { HarnessPills } from '@/components/features/runners/HarnessPills';
import { RunnerStanding } from '@/components/features/runners/RunnerStanding';
import { type NamedHarness, type Runner, seenAt } from '@/lib/runner';

type RunnerCardProps = {
  runner: Runner;
  harnesses: readonly NamedHarness[];
};

export function RunnerCard({ runner, harnesses }: RunnerCardProps) {
  return (
    <li className="flex min-h-36 flex-col justify-between gap-5 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate font-medium text-foreground text-sm">
            {runner.name}
          </h3>

          <span className="ml-auto">
            <RunnerStanding runner={runner} />
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
