import type { DiffLineAnnotation, SelectedLineRange } from '@pierre/diffs';
import { useMemo, useState } from 'react';
import { NewReviewComment } from '@/components/features/review/NewReviewComment';
import { ReviewGutterPlus } from '@/components/features/review/ReviewGutterPlus';
import { ReviewThreadCard } from '@/components/features/review/ReviewThreadCard';
import { COLLAPSE_MS } from '@/components/shared/Collapsible';
import { PatchCodeDiff } from '@/components/shared/PatchCodeDiff';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import { type DiffFile, type DiffHunk, patchOf } from '@/lib/change-stack';
import {
  type ReviewSpot,
  type ReviewThread,
  rangeOf,
  samePlace,
  selectionSideOf,
  spotOf,
  threadsIn,
  within,
} from '@/lib/review';
import { useReviewing } from '@/lib/review-context';

type Annotated =
  | { readonly kind: 'thread'; readonly thread: ReviewThread }
  | { readonly kind: 'composer'; readonly spot: ReviewSpot };

export function HunkReview({ file, hunk }: { file: DiffFile; hunk: DiffHunk }) {
  const reviewing = useReviewing();
  const patch = patchOf(file, hunk);
  const everyThread = reviewing?.threads;
  const threads = useMemo(
    () => (everyThread ? threadsIn(everyThread, file, hunk) : []),
    [everyThread, file, hunk],
  );
  const composing = reviewing?.composing ?? null;
  const composingHere =
    composing?.path === file.path &&
    within(hunk, composing.side, composing.line) &&
    !threads.some(({ root }) => samePlace(composing, root))
      ? composing
      : null;
  const shownComposer = useDelayedValue(composingHere, COLLAPSE_MS);
  const [firstSeen, setFirstSeen] = useState<ReadonlySet<string> | null>(null);
  const [dragging, setDragging] = useState<SelectedLineRange | null>(null);
  const [pointedAt, setPointedAt] = useState<SelectedLineRange | null>(null);

  const annotations = useMemo(
    (): DiffLineAnnotation<Annotated>[] => [
      ...threads.map((thread) => ({
        side: selectionSideOf(thread.root.side),
        lineNumber: thread.root.line,
        metadata: { kind: 'thread' as const, thread },
      })),
      ...(shownComposer
        ? [
            {
              side: selectionSideOf(shownComposer.side),
              lineNumber: shownComposer.line,
              metadata: { kind: 'composer' as const, spot: shownComposer },
            },
          ]
        : []),
    ],
    [threads, shownComposer],
  );

  if (firstSeen === null && reviewing?.review) {
    setFirstSeen(new Set(threads.map(({ root }) => root.id)));
  }

  if (!reviewing) {
    return <PatchCodeDiff path={file.path} patch={patch} />;
  }

  return (
    <PatchCodeDiff<Annotated>
      path={file.path}
      patch={patch}
      annotations={annotations}
      renderAnnotation={({ metadata }) =>
        metadata?.kind === 'thread' ? (
          <ReviewThreadCard
            thread={metadata.thread}
            onPointedAt={(pointing) =>
              setPointedAt(pointing ? rangeOf(metadata.thread.root) : null)
            }
            appear={!firstSeen?.has(metadata.thread.root.id)}
          />
        ) : metadata?.kind === 'composer' ? (
          <NewReviewComment
            spot={metadata.spot}
            open={composingHere !== null}
          />
        ) : null
      }
      gutter={(hovered) => <ReviewGutterPlus hovered={hovered} />}
      selected={
        dragging ?? (composingHere ? rangeOf(composingHere) : pointedAt)
      }
      onSelecting={setDragging}
      onSelected={(range) => {
        setDragging(null);

        if (range) {
          reviewing.compose(spotOf(file.path, range));
        }
      }}
    />
  );
}
