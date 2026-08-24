import { Link } from 'react-router';
import { type Runner, runnerTerminalPath, shortRunnerId } from '@/lib/runner';
import { cn } from '@/lib/utils';

type RunnerRowProps = {
  slug: string;
  runner: Runner;
  selected?: boolean;
};

export function RunnerRow({ slug, runner, selected }: RunnerRowProps) {
  return (
    <Link
      to={runnerTerminalPath(slug, runner.id)}
      data-slot="runner-row"
      className={cn(
        'flex items-center gap-3 rounded-md px-2 py-1.5 outline-none transition-colors',
        'hover:bg-accent',
        selected && 'bg-accent',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          runner.connected ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        )}
      />

      <span
        title={runner.id}
        className="min-w-0 truncate font-medium font-mono text-foreground text-xs"
      >
        {shortRunnerId(runner.id)}
      </span>

      <span className="ml-auto shrink-0 text-muted-foreground text-xs">
        {describe(runner)}
      </span>
    </Link>
  );
}

const describe = (runner: Runner): string => {
  if (!runner.connected) {
    return 'Not answering';
  }
  return runner.currentRun ? 'Running' : 'Idle';
};
