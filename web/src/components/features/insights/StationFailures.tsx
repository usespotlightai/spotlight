import { BarRow } from '@/components/features/insights/BarRow';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  formatRunFailure,
  formatTaskFailure,
  type StationReport,
} from '@/lib/insights';
import { runPath } from '@/lib/run';
import { cn } from '@/lib/utils';

const LINK = 'hover:underline';

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
  const both = report.runFailures.length > 0 && report.taskFailures.length > 0;
  const failedRuns = Math.max(
    report.tally.failed,
    ...report.runFailures.map((failure) => failure.runs),
    1,
  );
  const maxOccurrences = Math.max(
    ...report.taskFailures.map((failure) => failure.occurrences),
    1,
  );

  return (
    <div className={cn('grid gap-4', both && 'sm:grid-cols-2')}>
      {report.runFailures.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1">
          {both && (
            <p className="text-[0.7rem] text-muted-foreground">Run failures</p>
          )}
          <ul aria-label="Run failures" className="flex flex-col gap-1.5 pb-2">
            {report.runFailures.map((failure) => {
              const [only] = failure.runIds;
              const shown = formatRunFailure(failure);

              return (
                <BarRow
                  key={failure.failure ?? 'unsaid'}
                  share={failure.runs / failedRuns}
                  values={
                    <span className="w-10 text-right text-foreground tabular-nums">
                      {failure.runs}
                    </span>
                  }
                >
                  {only && failure.runIds.length === 1 ? (
                    <TrailLink
                      to={runPath(slug, teamId, only)}
                      className={LINK}
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
                </BarRow>
              );
            })}
          </ul>
        </div>
      )}

      {report.taskFailures.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1">
          {both && (
            <p className="text-[0.7rem] text-muted-foreground">Task failures</p>
          )}
          <ul aria-label="Task failures" className="flex flex-col gap-1.5 pb-2">
            {report.taskFailures.map((failure) => {
              const [only] = failure.taskIds;
              const shown = formatTaskFailure(failure);

              return (
                <BarRow
                  key={`${failure.source}:${failure.code}`}
                  share={failure.occurrences / maxOccurrences}
                  values={
                    <span className="w-10 text-right text-foreground tabular-nums">
                      {failure.occurrences}
                    </span>
                  }
                >
                  {only && failure.taskIds.length === 1 ? (
                    <InsightsLink tab="runs" filter={{ taskId: only }}>
                      {shown}
                    </InsightsLink>
                  ) : (
                    shown
                  )}
                  {failure.maxInARow > 1 && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {failure.maxInARow} in a row
                    </span>
                  )}
                </BarRow>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
