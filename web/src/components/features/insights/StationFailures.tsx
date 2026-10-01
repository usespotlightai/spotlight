import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  runFailureShown,
  type StationReport,
  taskFailureShown,
} from '@/lib/insights';
import { runPath } from '@/lib/run';

type StationFailuresProps = {
  slug: string;
  teamId: string;
  report: StationReport;
};

export function StationFailures({
  slug,
  teamId,
  report,
}: StationFailuresProps) {
  if (report.taskFailures.length === 0 && report.runFailures.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-muted-foreground">Task failures</p>
        {report.taskFailures.length === 0 ? (
          <p className="text-faint">None</p>
        ) : (
          <ul aria-label="Task failures" className="flex flex-col">
            {report.taskFailures.map((failure) => {
              const [only] = failure.taskIds;
              const shown = taskFailureShown(failure);

              return (
                <li
                  key={`${failure.source}:${failure.code}`}
                  className="truncate text-foreground"
                >
                  {only && failure.taskIds.length === 1 ? (
                    <InsightsLink tab="runs" filter={{ taskId: only }}>
                      {shown}
                    </InsightsLink>
                  ) : (
                    shown
                  )}
                  {failure.mostInARow > 1 && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {failure.mostInARow} in a row
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-muted-foreground">Run failures</p>
        {report.runFailures.length === 0 ? (
          <p className="text-faint">None</p>
        ) : (
          <ul aria-label="Run failures" className="flex flex-col">
            {report.runFailures.map((failure) => {
              const [only] = failure.runIds;
              const shown = runFailureShown(failure);

              return (
                <li
                  key={failure.failure ?? 'unsaid'}
                  className="truncate text-foreground"
                >
                  {only && failure.runIds.length === 1 ? (
                    <TrailLink
                      to={runPath(slug, teamId, only)}
                      className="hover:underline"
                    >
                      {shown}
                    </TrailLink>
                  ) : (
                    <InsightsLink
                      tab="runs"
                      filter={{
                        stationId: report.stationId,
                        outcome: 'failed',
                      }}
                    >
                      {shown}
                    </InsightsLink>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
