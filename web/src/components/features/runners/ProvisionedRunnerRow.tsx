import { PROVISIONED_COLUMNS } from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import {
  type NamedHarness,
  type ProvisionedRunner,
  since,
  through,
} from '@/lib/runner';
import { cn } from '@/lib/utils';

type ProvisionedRunnerRowProps = {
  runner: ProvisionedRunner;
  harnesses: readonly NamedHarness[];
};

export function ProvisionedRunnerRow({
  runner,
  harnesses,
}: ProvisionedRunnerRowProps) {
  return (
    <li
      className={cn(
        'grid h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors hover:bg-accent',
        PROVISIONED_COLUMNS,
      )}
    >
      <span className="min-w-0 truncate text-foreground">
        {through(runner.through)}
      </span>

      <span className="truncate text-muted-foreground text-xs">
        {runner.currentRun ? 'Running' : 'Starting'}
      </span>

      <HarnessLogos harnesses={harnesses} />

      <span className="truncate text-right text-muted-foreground text-xs tabular-nums">
        Started {since(runner.startedAt)}
      </span>
    </li>
  );
}
