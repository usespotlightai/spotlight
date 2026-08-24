import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import { RunTerminal } from '@/components/runners/RunTerminal';
import { useStartSession, useStopSession } from '@/hooks/api/useRunnerSession';
import { useRunners } from '@/hooks/api/useRunners';

export function RunnerTerminal() {
  const { slug, runnerId } = useParams();
  const { data: runners } = useRunners();
  const start = useStartSession();
  const stop = useStopSession();

  const runner = runners?.find((candidate) => candidate.id === runnerId);

  if (!runner) {
    return <Empty>No runner is registered under that id.</Empty>;
  }

  if (!runner.currentRun) {
    if (!runner.connected) {
      return (
        <Empty>This runner has stopped answering the control plane.</Empty>
      );
    }

    // Scoped to this runner: the component is reused across :runnerId, so an
    // unscoped mutation state marks every other idle runner as starting.
    const claiming =
      (start.isPending || start.isSuccess) &&
      start.variables?.runnerId === runner.id;

    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-muted-foreground text-sm">
          {claiming
            ? 'Waiting for the runner to pick the session up…'
            : 'This runner is idle.'}
        </p>

        <button
          type="button"
          disabled={claiming || !slug}
          onClick={() =>
            slug &&
            start.mutate({ slug, pool: runner.pool, runnerId: runner.id })
          }
          className="h-7 rounded-md border-[0.5px] border-border px-3 font-medium text-foreground text-xs outline-none transition-colors hover:bg-accent disabled:opacity-50"
        >
          {claiming ? 'Starting…' : 'Start session'}
        </button>

        {start.isError && (
          <p className="text-destructive text-xs">{start.error.message}</p>
        )}
      </div>
    );
  }

  const session = runner.currentRun;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b-[0.5px] border-border px-3">
        <span className="font-medium text-foreground text-xs">Terminal</span>
        <span
          title={session.id}
          className="truncate font-mono text-muted-foreground text-xs"
        >
          {session.id}
        </span>

        <button
          type="button"
          disabled={stop.isPending}
          onClick={() => stop.mutate(session.id)}
          className="ml-auto h-6 shrink-0 rounded-md border-[0.5px] border-border px-2 text-muted-foreground text-xs outline-none transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {stop.isPending ? 'Stopping…' : 'Stop'}
        </button>
      </div>

      <RunTerminal key={session.id} runId={session.id} />
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  );
}
