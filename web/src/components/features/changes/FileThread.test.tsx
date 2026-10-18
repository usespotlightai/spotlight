import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileThread } from '@/components/features/changes/FileThread';
import type { CodeReview, ReviewComment } from '@/lib/review';
import { ReviewContext } from '@/lib/review-context';

const draft = vi.fn();

vi.mock('@/hooks/api/useDraftReviewComment', () => ({
  useDraftReviewComment: () => ({
    isPending: false,
    mutate: draft,
  }),
}));
vi.mock('@/hooks/api/useEditReviewComment', () => ({
  useEditReviewComment: () => ({ isPending: false }),
}));
vi.mock('@/hooks/api/useDeleteReviewComment', () => ({
  useDeleteReviewComment: () => ({ isPending: false }),
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: undefined }),
}));

const PATH = 'api/src/uploads.ts';

const comment = (over: Partial<ReviewComment>): ReviewComment =>
  ({
    id: 'comment_1',
    path: PATH,
    side: 'new',
    line: null,
    startLine: null,
    body: 'Does this need a lock?',
    authorName: 'Maya Chen',
    authorLogin: null,
    authorImage: null,
    viewerIsAuthor: false,
    isAgentAuthored: false,
    replyTo: null,
    state: 'posted',
    failure: null,
    url: null,
    createdAt: '2026-09-21T10:00:00.000Z',
    editedAt: null,
    ...over,
  }) as ReviewComment;

const shown = (
  comments: ReviewComment[],
  note: string | null,
  replying = true,
) =>
  render(
    <ReviewContext
      value={{
        teamId: 'team_1',
        runId: 'run_1',
        review: { comments } as unknown as CodeReview,
        threads: [],
        composing: null,
        composerAppears: false,
        compose: vi.fn(),
      }}
    >
      <FileThread
        path={PATH}
        note={note}
        replying={replying}
        onReplying={vi.fn()}
      />
    </ReviewContext>,
  );

const reply = async (label: string) => {
  await userEvent.type(screen.getByRole('textbox', { name: label }), 'Yes.');
  await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
};

describe('FileThread', () => {
  it('follows Spotlight’s summary with the comments on the whole file', () => {
    shown(
      [comment({}), comment({ id: 'comment_2', line: 12, body: 'On a line' })],
      'Adds the upload retries.',
      false,
    );

    const thread = screen.getByRole('region', { name: `Comments on ${PATH}` });

    expect(thread).toHaveTextContent('Adds the upload retries.');
    expect(thread).toHaveTextContent('Does this need a lock?');
    expect(thread).not.toHaveTextContent('On a line');
  });

  it('starts a comment on the whole file when there is none', async () => {
    draft.mockClear();
    shown([], 'Adds the upload retries.');

    await reply('Reply to the summary');

    expect(draft).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Yes.', on: { path: PATH } }),
      expect.anything(),
    );
  });

  it('leaves it to the review to thread a comment on a file that has one', async () => {
    draft.mockClear();
    shown([comment({})], null);

    await reply(`Comment on ${PATH}`);

    expect(draft).toHaveBeenCalledWith(
      expect.objectContaining({ on: { path: PATH } }),
      expect.anything(),
    );
  });

  it('shows nothing where there is no comment and nothing to write', () => {
    shown([], null, false);

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
