import { describe, expect, it } from 'vitest';

import type { DiffFile, DiffHunk } from '@/lib/change-stack';
import {
  type CodeReview,
  drafts,
  linesOf,
  type ReviewComment,
  rangeOf,
  reviewOfStack,
  routeOf,
  samePlace,
  sideOf,
  spotOf,
  threadsIn,
  threadsOf,
  within,
} from '@/lib/review';

const comment = (over: Partial<ReviewComment>): ReviewComment => ({
  id: 'comment_1',
  repository: null,
  path: 'src/a.ts',
  side: 'new',
  line: 12,
  startLine: null,
  body: 'Why?',
  authorName: 'Ada',
  authorLogin: null,
  authorImage: null,
  viewerIsAuthor: false,
  isAgentAuthored: false,
  replyTo: null,
  state: 'posted',
  failure: null,
  url: null,
  createdAt: '2026-09-16T10:00:00Z',
  editedAt: null,
  ...over,
});

const HUNK: DiffHunk = {
  id: 'h1',
  oldStart: 10,
  oldLines: 3,
  newStart: 10,
  newLines: 5,
  patch: '@@ -10,3 +10,5 @@',
};

const FILE: DiffFile = {
  path: 'src/a.ts',
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [HUNK],
};

describe('threadsOf', () => {
  it('gathers replies under the comment that began each thread', () => {
    const threads = threadsOf([
      comment({ id: 'c1' }),
      comment({ id: 'c2', line: 40 }),
      comment({ id: 'c3', replyTo: 'c1' }),
    ]);

    expect(
      threads.map(({ root, replies }) => [
        root.id,
        replies.map((each) => each.id),
      ]),
    ).toEqual([
      ['c1', ['c3']],
      ['c2', []],
    ]);
  });
});

describe('within', () => {
  it('tells whether a line falls in a hunk on its side', () => {
    expect(within(HUNK, 'new', 14)).toBe(true);
    expect(within(HUNK, 'new', 15)).toBe(false);
    expect(within(HUNK, 'old', 12)).toBe(true);
    expect(within(HUNK, 'old', 13)).toBe(false);
  });
});

describe('threadsIn', () => {
  it('keeps the threads on a hunk’s lines of its file', () => {
    const threads = threadsOf([
      comment({ id: 'here', line: 11 }),
      comment({ id: 'later', line: 90 }),
      comment({ id: 'elsewhere', path: 'src/b.ts', line: 11 }),
    ]);

    expect(threadsIn(threads, FILE, HUNK).map(({ root }) => root.id)).toEqual([
      'here',
    ]);
  });
});

describe('sideOf', () => {
  it('reads the diff’s side as the side of the change', () => {
    expect(sideOf('deletions')).toBe('old');
    expect(sideOf('additions')).toBe('new');
    expect(sideOf(undefined)).toBe('new');
  });
});

describe('samePlace', () => {
  it('matches a spot by file, side and line', () => {
    const spot = {
      path: 'src/a.ts',
      side: 'new' as const,
      line: 3,
      startLine: null,
    };

    expect(samePlace(spot, { ...spot })).toBe(true);
    expect(samePlace(spot, { ...spot, side: 'old' })).toBe(false);
    expect(samePlace(null, spot)).toBe(false);
  });
});

describe('routeOf', () => {
  const WEB = 'https://github.com/acme/web/pull/7';
  const review = (landings: CodeReview['landings']): CodeReview => ({
    landings,
    reviews: [],
    comments: [],
  });

  it('answers from the routes the server gives, for a repository in any case', () => {
    const both = review([
      { repository: null, route: 'ambiguous', pullRequest: null },
      { repository: 'web', route: 'routed', pullRequest: WEB },
      {
        repository: 'docs',
        route: 'routed',
        pullRequest: 'https://github.com/acme/docs/pull/3',
      },
    ]);

    expect(routeOf(both, 'Docs')).toBe('routed');
    expect(routeOf(both, 'infra')).toBe('waiting');
    expect(routeOf(both, null)).toBe('ambiguous');
  });

  it('routes what names no repository only where the server routes it', () => {
    expect(
      routeOf(
        review([{ repository: null, route: 'routed', pullRequest: WEB }]),
        null,
      ),
    ).toBe('routed');
    expect(
      routeOf(
        review([{ repository: null, route: 'waiting', pullRequest: null }]),
        null,
      ),
    ).toBe('waiting');
    expect(routeOf(undefined, 'web')).toBe('waiting');
  });
});

describe('drafts', () => {
  it('counts the caller’s drafts', () => {
    expect(
      drafts({
        landings: [],
        reviews: [],
        comments: [
          comment({ state: 'draft' }),
          comment({ state: 'sending' }),
          comment({ state: 'draft' }),
        ],
      }),
    ).toBe(2);
    expect(drafts(undefined)).toBe(0);
  });
});

describe('spotOf', () => {
  it('reads a selection on one side as a range, whichever way it was dragged', () => {
    expect(spotOf('src/a.ts', { start: 9, end: 4, side: 'additions' })).toEqual(
      { path: 'src/a.ts', side: 'new', line: 9, startLine: 4 },
    );
  });

  it('reads a single line as that line', () => {
    expect(spotOf('src/a.ts', { start: 7, end: 7, side: 'deletions' })).toEqual(
      { path: 'src/a.ts', side: 'old', line: 7, startLine: null },
    );
  });

  it('keeps only the last line where a selection crosses sides', () => {
    expect(
      spotOf('src/a.ts', {
        start: 3,
        end: 5,
        side: 'deletions',
        endSide: 'additions',
      }),
    ).toEqual({ path: 'src/a.ts', side: 'new', line: 5, startLine: null });
  });
});

describe('rangeOf and linesOf', () => {
  it('turn a spot back into a selection and words', () => {
    const spot = {
      path: 'src/a.ts',
      side: 'new' as const,
      line: 9,
      startLine: 4,
    };

    expect(rangeOf(spot)).toEqual({ start: 4, end: 9, side: 'additions' });
    expect(linesOf(spot)).toBe('lines 4–9');
    expect(linesOf({ ...spot, startLine: null })).toBe('line 9');
  });
});

describe('reviewOfStack', () => {
  const review = {
    landings: [],
    reviews: [],
    comments: [
      comment({ id: 'in_web', repository: 'web' }),
      comment({ id: 'in_docs', repository: 'Docs' }),
      comment({ id: 'unnamed', repository: null }),
    ],
  };
  const ids = (repository: string | null, alone: boolean) =>
    reviewOfStack(review, repository, alone)?.comments.map((each) => each.id);

  it('shows only the comments of the stack’s repository, in any case', () => {
    expect(ids('docs', false)).toEqual(['in_docs']);
    expect(ids('web', false)).toEqual(['in_web']);
  });

  it('shows comments that name no repository on a stack that names none', () => {
    expect(ids(null, false)).toEqual(['unnamed']);
  });

  it('adds comments that name no repository where the run has one stack, but not those of another repository', () => {
    expect(ids('web', true)).toEqual(['in_web', 'unnamed']);
  });
});
