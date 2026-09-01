import { Link } from 'react-router';
import { StationIcon } from '@/components/board/StationIcon';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { took } from '@/lib/inbox';
import { aged, type TeamRun } from '@/lib/run';
import { stationShare } from '@/lib/station';
import { taskTracePath } from '@/lib/task';

interface Traced {
  readonly taskId: string;
  readonly title: string;
  readonly runs: readonly TeamRun[];
  readonly from: number;
  readonly to: number;
  readonly failed: number;
}

const at = (iso: string): number => new Date(iso).getTime();

/**
 * One trace per task, since that is what a trace is here: every run that
 * worked it, however many stations it passed through on the way.
 */
const traced = (runs: readonly TeamRun[]): Traced[] => {
  const held = new Map<string, TeamRun[]>();

  for (const run of runs) {
    if (run.taskId) {
      held.set(run.taskId, [...(held.get(run.taskId) ?? []), run]);
    }
  }

  return [...held.entries()]
    .map(([taskId, worked]) => ({
      taskId,
      title: worked[0]?.taskTitle ?? 'Untitled',
      runs: worked,
      from: Math.min(...worked.map((run) => at(run.startedAt))),
      to: Math.max(...worked.map((run) => at(run.updatedAt))),
      failed: worked.filter((run) => run.state === 'failed').length,
    }))
    .sort((one, other) => other.to - one.to);
};

export function TraceList({ slug, teamId }: { slug: string; teamId: string }) {
  const { data: runs, isPending } = useTeamRuns(teamId);

  if (isPending) {
    return null;
  }

  const traces = traced(runs ?? []);

  if (traces.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          Nothing has been run for this team yet.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
      <div className="flex h-8 items-center gap-3 px-3 text-muted-foreground text-xs">
        <span className="min-w-0 flex-1">Task</span>
        <span className="w-16 text-right">Runs</span>
        <span className="w-20 text-right">Took</span>
        <span className="w-16 text-right">Faults</span>
        <span className="w-24 text-right">Last worked</span>
      </div>

      <ul className="flex flex-col">
        {traces.map((trace) => (
          <li
            key={trace.taskId}
            className="relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors hover:bg-accent"
          >
            {trace.runs[0]?.station ? (
              <StationIcon
                share={stationShare(
                  trace.runs[0].station.position,
                  trace.runs[0].station.count,
                )}
                color={trace.runs[0].station.color}
              />
            ) : (
              <span className="size-4 shrink-0" aria-hidden />
            )}

            <Link
              to={taskTracePath(slug, teamId, trace.taskId)}
              className="min-w-0 flex-1 truncate text-foreground outline-none after:absolute after:inset-0 after:rounded-md"
            >
              {trace.title}
            </Link>

            <span className="w-16 text-right text-muted-foreground tabular-nums">
              {trace.runs.length}
            </span>
            <span className="w-20 text-right text-muted-foreground tabular-nums">
              {took(Math.max(trace.to - trace.from, 0))}
            </span>
            <span
              className={
                trace.failed > 0
                  ? 'w-16 text-right text-destructive tabular-nums'
                  : 'w-16 text-right text-muted-foreground tabular-nums'
              }
            >
              {trace.failed}
            </span>
            <span className="w-24 truncate text-right text-muted-foreground">
              {aged(new Date(trace.to).toISOString())}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
