import type { PullRequestReason } from '@/lib/search-words';
import { formatPullRequestReason } from '@/lib/search-words';

type PullRequestErrorProps = {
  reason: PullRequestReason;
};

const formatWanted = (wanted: PullRequestReason['wanted']): string =>
  typeof wanted === 'string' ? wanted : JSON.stringify(wanted);

export function PullRequestError({ reason }: PullRequestErrorProps) {
  return (
    <div data-slot="pull-request-error" className="flex flex-col gap-0.5">
      <p className="text-foreground">{formatPullRequestReason(reason)}</p>
      <p className="text-muted-foreground">{reason.message}</p>
      {reason.attribute && (
        <p className="text-muted-foreground">
          At <span className="text-foreground">{reason.attribute}</span>
          {reason.expression && (
            <>
              , computed by{' '}
              <span className="break-all text-foreground">
                {reason.expression}
              </span>
            </>
          )}
          {reason.wanted !== null && (
            <>
              . Please set it by hand to{' '}
              <span className="break-all text-foreground">
                {formatWanted(reason.wanted)}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
