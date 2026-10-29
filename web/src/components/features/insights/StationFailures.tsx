import { FailureSlices } from '@/components/features/insights/FailureSlices';
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

  return (
    <div className={cn('grid gap-4', both && 'sm:grid-cols-2')}>
      {report.runFailures.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1">
          {both && (
            <p className="text-[0.7rem] text-muted-foreground">Run failures</p>
          )}
          <FailureSlices
            label="Run failures"
            of="the failed runs"
            slices={report.runFailures.map((failure) => {
              const [only] = failure.runIds;
              const shown = formatRunFailure(failure);

              return {
                key: failure.failure ?? 'without-failure',
                count: failure.runs,
                label:
                  only && failure.runIds.length === 1 ? (
                    <TrailLink
                      to={runPath(slug, teamId, only)}
                      className={LINK}
                    >
                      {shown}
                    </TrailLink>
                  ) : (
                    <InsightsLink
                      tab="traces"
                      filter={{
                        stationId: report.stationId,
                        outcome: 'failed',
                      }}
                    >
                      {shown}
                    </InsightsLink>
                  ),
              };
            })}
          />
        </div>
      )}

      {report.taskFailures.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1">
          {both && (
            <p className="text-[0.7rem] text-muted-foreground">Task failures</p>
          )}
          <FailureSlices
            label="Task failures"
            of="the task failures"
            slices={report.taskFailures.map((failure) => {
              const [only] = failure.taskIds;
              const shown = formatTaskFailure(failure);

              return {
                key: `${failure.source}:${failure.code}`,
                count: failure.occurrences,
                label: (
                  <>
                    {only && failure.taskIds.length === 1 ? (
                      <InsightsLink tab="traces" filter={{ taskId: only }}>
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
                  </>
                ),
              };
            })}
          />
        </div>
      )}
    </div>
  );
}
