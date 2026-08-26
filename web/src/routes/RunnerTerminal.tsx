import { type ReactNode, useEffect } from 'react';
import { useParams } from 'react-router';
import { RunTerminal } from '@/components/runners/RunTerminal';
import { Button } from '@/components/ui/button';
import { useStartSession, useStopSession } from '@/hooks/api/useRunnerSession';
import { useRunners } from '@/hooks/api/useRunners';

export function RunnerTerminal() {
  const { slug, runnerId } = useParams();
  const { data: runners } = useRunners();
  const start = useStartSession();
  const stop = useStopSession();

  const runner = runners?.find((candidate) => candidate.id === runnerId);
  const session = runner?.currentRun;

  const { reset: forgetStart, isSuccess: started } = start;
  useEffect(() => {
    if (session && started) {
      forgetStart();
    }
  }, [session, started, forgetStart]);

  const { reset: forgetStop, isPending: asking, isSuccess: asked } = stop;
  useEffect(() => {
    if (!session && asked) {
      forgetStop();
    }
  }, [session, asked, forgetStop]);

  const ending = Boolean(session) && (asking || asked);

  if (!runner) {
    return <Empty>No runner is enrolled under that id.</Empty>;
  }

  if (!session) {
    if (runner.revokedAt) {
      return (
        <Empty>
          This runner’s token was revoked. Enrol a new runner to replace it.
        </Empty>
      );
    }

    if (!runner.lastSeenAt) {
      return (
        <Empty>
          This runner has not connected yet. Start it with the token it was
          given.
        </Empty>
      );
    }

    if (!runner.connected) {
      return (
        <Empty>This runner has stopped answering the control plane.</Empty>
      );
    }

    // Scoped to this runner. The component is reused across :runnerId, so an
    // unscoped mutation state marks every other idle runner as starting.
    const claiming =
      (start.isPending || start.isSuccess) &&
      start.variables?.runnerId === runner.id;

    return (
      <div className="flex min-h-0 flex-1 animate-in flex-col items-center justify-center gap-3 p-8 duration-200 fade-in ease-out-quad">
        <p
          key={claiming ? 'claiming' : 'idle'}
          className="animate-in text-muted-foreground text-sm duration-200 fade-in ease-out-quad"
        >
          {claiming
            ? 'Waiting for the runner to pick the session up…'
            : 'This runner is idle.'}
        </p>

        <Button
          variant="outline"
          size="sm"
          disabled={claiming || !slug}
          onClick={() =>
            slug &&
            start.mutate({ slug, pool: runner.pool, runnerId: runner.id })
          }
        >
          {claiming ? 'Starting…' : 'Start session'}
        </Button>

        {start.isError && (
          <p className="text-destructive text-xs">{start.error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b-[0.5px] border-border px-3">
        <span className="font-medium text-foreground text-xs">Terminal</span>

        {stop.isError && (
          <span className="shrink-0 text-destructive text-xs">
            {stop.error.message}
          </span>
        )}

        <button
          type="button"
          disabled={ending}
          onClick={() => stop.mutate(session.id)}
          className="ml-auto flex h-6 shrink-0 items-center rounded-full border-[0.5px] border-border bg-card px-2.5 font-medium text-muted-foreground text-sm shadow-[0px_4px_4px_-1px_#0000000a,0px_1px_1px_0px_#00000014] outline-none transition-colors duration-100 ease-out-quad hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {ending ? 'Stopping…' : 'Stop'}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <RunTerminal key={session.id} runId={session.id} />

        {ending && (
          <div
            data-slot="session-ending"
            className="absolute inset-0 z-10 flex animate-in items-center justify-center bg-background/60 backdrop-blur-xs duration-200 fade-in ease-out-quad"
          />
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 animate-in items-center justify-center p-8 duration-200 fade-in ease-out-quad">
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  );
}
