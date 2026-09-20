import type { SelectedLineRange, SelectionSide } from '@pierre/diffs';
import type {
  CodeReviewResponseDto,
  ReviewCommentResponseDto,
  ReviewResponseDto,
} from '@/lib/api';
import type { DiffFile, DiffHunk } from '@/lib/change-stack';

export type CodeReview = CodeReviewResponseDto;

export type ReviewComment = ReviewCommentResponseDto;

type SubmittedReview = ReviewResponseDto;

export type ReviewSide = ReviewComment['side'];

export type ReviewVerdict = SubmittedReview['verdict'];

export interface ReviewSpot {
  readonly path: string;
  readonly side: ReviewSide;
  readonly line: number;
  readonly startLine: number | null;
}

export interface ReviewThread {
  readonly root: ReviewComment;
  readonly replies: readonly ReviewComment[];
}

export const VERDICTS: readonly {
  readonly id: ReviewVerdict;
  readonly label: string;
  readonly told: string;
}[] = [
  { id: 'comment', label: 'Comment', told: 'Feedback without a verdict' },
  { id: 'approve', label: 'Approve', told: 'Good to merge' },
  {
    id: 'request-changes',
    label: 'Request changes',
    told: 'Needs another pass before merging',
  },
];

export const threadsOf = (comments: readonly ReviewComment[]): ReviewThread[] =>
  comments
    .filter((comment) => comment.replyTo === null)
    .map((root) => ({
      root,
      replies: comments.filter((comment) => comment.replyTo === root.id),
    }));

export const sideOf = (selection: SelectionSide | undefined): ReviewSide =>
  selection === 'deletions' ? 'old' : 'new';

export const selectionSideOf = (side: ReviewSide): SelectionSide =>
  side === 'old' ? 'deletions' : 'additions';

export const within = (hunk: DiffHunk, side: ReviewSide, line: number) => {
  const start = side === 'old' ? hunk.oldStart : hunk.newStart;
  const count = side === 'old' ? hunk.oldLines : hunk.newLines;

  return line >= start && line < start + Math.max(count, 1);
};

export const threadsIn = (
  threads: readonly ReviewThread[],
  file: DiffFile,
  hunk: DiffHunk,
): ReviewThread[] =>
  threads.filter(
    ({ root }) => root.path === file.path && within(hunk, root.side, root.line),
  );

export const rangeOf = (spot: ReviewSpot): SelectedLineRange => ({
  start: spot.startLine ?? spot.line,
  end: spot.line,
  side: selectionSideOf(spot.side),
});

export const spotOf = (path: string, range: SelectedLineRange): ReviewSpot => {
  const endSide = range.endSide ?? range.side;

  if (range.side !== endSide) {
    return { path, side: sideOf(endSide), line: range.end, startLine: null };
  }

  const first = Math.min(range.start, range.end);
  const last = Math.max(range.start, range.end);

  return {
    path,
    side: sideOf(endSide),
    line: last,
    startLine: first === last ? null : first,
  };
};

export const linesOf = (spot: ReviewSpot): string =>
  spot.startLine === null
    ? `line ${spot.line}`
    : `lines ${spot.startLine}–${spot.line}`;

export const samePlace = (spot: ReviewSpot | null, other: ReviewSpot) =>
  spot !== null &&
  spot.path === other.path &&
  spot.side === other.side &&
  spot.line === other.line;

export const drafts = (review: CodeReview | undefined): number =>
  review?.comments.filter((comment) => comment.state === 'draft').length ?? 0;

export const whoWrote = (comment: ReviewComment): string =>
  comment.yours ? 'You' : comment.authorName;
