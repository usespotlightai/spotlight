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
          At{' '}
          <code className="font-mono text-foreground">{reason.attribute}</code>
          {reason.expression && (
            <>
              , computed by{' '}
              <code className="break-all font-mono text-foreground">
                {reason.expression}
              </code>
            </>
          )}
          {reason.wanted !== null && (
            <>
              . Please set it by hand to{' '}
              <code className="break-all font-mono text-foreground">
                {formatWanted(reason.wanted)}
              </code>
            </>
          )}
        </p>
      )}
    </div>
  );
}
