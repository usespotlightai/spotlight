import { TrailLink } from '@/components/shell/layout/TrailLink';
import { runPath } from '@/lib/run';
import { OPEN_FAILED_REPLAY, SUGGESTED } from '@/lib/search-words';

type StallTaskProps = {
  slug: string;
  teamId: string;
  title: string;
  replayRunId: string;
  evidence?: string;
  suggestion?: string | null;
};

export function StallTask({
  slug,
  teamId,
  title,
  replayRunId,
  evidence,
  suggestion,
}: StallTaskProps) {
  return (
    <li
      data-slot="stall-task"
      className="flex flex-col gap-0.5 border-border border-t pt-2 text-xs first:border-t-0 first:pt-0"
    >
      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="font-medium text-foreground">{title}</span>
        <TrailLink
          to={runPath(slug, teamId, replayRunId)}
          aria-label={`${OPEN_FAILED_REPLAY}: ${title}`}
          className="text-foreground underline-offset-2 hover:underline"
        >
          {OPEN_FAILED_REPLAY}
        </TrailLink>
      </span>
      {evidence && (
        <p className="whitespace-pre-wrap text-muted-foreground leading-5">
          {evidence}
        </p>
      )}
      {suggestion && (
        <p className="text-foreground leading-5">
          <span className="font-medium">{SUGGESTED}</span> {suggestion}
        </p>
      )}
    </li>
  );
}
