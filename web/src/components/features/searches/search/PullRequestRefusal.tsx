import type { PullRequestReason } from '@/lib/search-words';
import { pullRequestReasonShown } from '@/lib/search-words';

type PullRequestRefusalProps = {
  reason: PullRequestReason;
};

const wantedShown = (wanted: PullRequestReason['wanted']): string =>
  typeof wanted === 'string' ? wanted : JSON.stringify(wanted);

export function PullRequestRefusal({ reason }: PullRequestRefusalProps) {
  return (
    <div data-slot="pull-request-refusal" className="flex flex-col gap-0.5">
      <p className="text-foreground">{pullRequestReasonShown(reason)}</p>
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
                {wantedShown(reason.wanted)}
              </code>
            </>
          )}
        </p>
      )}
    </div>
  );
}
