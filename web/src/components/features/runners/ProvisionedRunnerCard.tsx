import { HarnessPills } from '@/components/features/runners/HarnessPills';
import {
  type NamedHarness,
  type ProvisionedRunner,
  since,
  through,
} from '@/lib/runner';

type ProvisionedRunnerCardProps = {
  runner: ProvisionedRunner;
  harnesses: readonly NamedHarness[];
};

export function ProvisionedRunnerCard({
  runner,
  harnesses,
}: ProvisionedRunnerCardProps) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-2">
        <h3 className="truncate font-medium text-foreground text-sm">
          {through(runner.through)}
        </h3>

        <span className="ml-auto shrink-0 font-medium text-muted-foreground text-xs">
          {runner.currentRun ? 'Running' : 'Starting'}
        </span>
      </div>

      <HarnessPills harnesses={harnesses} />

      <p className="text-muted-foreground text-xs tabular-nums">
        Started {since(runner.startedAt)}
      </p>
    </li>
  );
}
