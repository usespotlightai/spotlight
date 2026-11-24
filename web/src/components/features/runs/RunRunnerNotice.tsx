import { formatDate } from '@/lib/date-format';
import { type Run, waitReason } from '@/lib/run';
import { since } from '@/lib/since';

type RunRunnerNoticeProps = {
  run: Pick<Run, 'state' | 'waiting'>;
};

export function RunRunnerNotice({ run }: RunRunnerNoticeProps) {
  const reason = waitReason(run);

  if (reason && run.waiting) {
    return (
      <p
        role="status"
        aria-label="Why the run waits"
        data-slot="run-runner"
        className="px-3 pb-2 text-muted-foreground text-xs"
      >
        <span className="font-medium text-foreground">Waiting:</span> {reason}{' '}
        <time
          dateTime={run.waiting.since}
          title={formatDate(new Date(run.waiting.since), {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        >
          ({since(run.waiting.since)})
        </time>
      </p>
    );
  }

  return null;
}
