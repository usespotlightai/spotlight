import { useId } from 'react';
import { ReplayableRunRow } from '@/components/features/replays/set/ReplayableRunRow';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import type { useReplaySetSuggestions } from '@/hooks/api/useReplaySetSuggestions';
import { failed, loading } from '@/lib/query';
import {
  SUGGESTIONS_LABEL,
  SUGGESTIONS_NOTE,
  turnedOutShown,
} from '@/lib/replay-words';

type SuggestedRunsProps = {
  suggestions: ReturnType<typeof useReplaySetSuggestions>;
  held: ReadonlySet<string>;
  adding: (runId: string) => boolean;
  onAdd: (runId: string) => void;
};

export function SuggestedRuns({
  suggestions,
  held,
  adding,
  onAdd,
}: SuggestedRunsProps) {
  const headingId = useId();

  if (loading(suggestions)) {
    return (
      <div
        role="status"
        aria-label="Loading suggested runs"
        className="px-2 py-2"
      >
        <SkeletonLine className="w-40 text-xs" />
        <SkeletonLine className="w-48 text-sm" />
      </div>
    );
  }

  if (failed(suggestions)) {
    return (
      <CouldNotLoad
        what="Suggested runs"
        retrying={suggestions.isFetching}
        onRetry={() => void suggestions.refetch()}
        className="py-3"
      />
    );
  }

  const suggested = suggestions.data ?? [];

  if (suggested.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={headingId}
      data-slot="suggested-runs"
      className="flex flex-col gap-0.5 border-border border-b pb-2"
    >
      <h3
        id={headingId}
        className="px-2 pt-1 font-medium text-foreground text-xs"
      >
        {SUGGESTIONS_LABEL}
      </h3>
      <p className="px-2 text-muted-foreground text-xs leading-5">
        {SUGGESTIONS_NOTE}
      </p>
      <ul aria-label={SUGGESTIONS_LABEL} className="flex flex-col">
        {suggested.map((run) => (
          <ReplayableRunRow
            key={run.runId}
            run={run}
            note={turnedOutShown(run.outcome)}
            inSet={held.has(run.runId)}
            adding={adding(run.runId)}
            onAdd={() => onAdd(run.runId)}
          />
        ))}
      </ul>
    </section>
  );
}
