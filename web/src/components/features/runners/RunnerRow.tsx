import { HarnessPills } from '@/components/features/runners/HarnessPills';
import { RunnerStanding } from '@/components/features/runners/RunnerStanding';
import type { NamedHarness, Runner } from '@/lib/runner';

type RunnerRowProps = {
  runner: Runner;
  harnesses: readonly NamedHarness[];
};

export function RunnerRow({ runner, harnesses }: RunnerRowProps) {
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2">
      <span className="truncate font-medium text-foreground text-sm">
        {runner.name}
      </span>

      <RunnerStanding runner={runner} />

      <span className="ml-auto">
        <HarnessPills harnesses={harnesses} named={2} />
      </span>
    </li>
  );
}
