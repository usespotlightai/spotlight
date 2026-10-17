import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewThreadCard } from '@/components/features/review/ReviewThreadCard';
import { type CodeReview, threadsOf } from '@/lib/review';
import { ReviewContext } from '@/lib/review-context';
import { REVIEW } from '@/test/fixtures/change-stack';

const drafting = vi.fn();
const editing = vi.fn();
const deleting = vi.fn();

vi.mock('@/hooks/api/useDraftReviewComment', () => ({
  useDraftReviewComment: () => ({
    mutate: drafting,
    isPending: false,
  }),
}));

vi.mock('@/hooks/api/useEditReviewComment', () => ({
  useEditReviewComment: () => ({
    mutate: editing,
    isPending: false,
  }),
}));

vi.mock('@/hooks/api/useDeleteReviewComment', () => ({
  useDeleteReviewComment: () => ({ mutate: deleting, isPending: false }),
}));

const within_ = (review: CodeReview, children: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    <ReviewContext
      value={{
        teamId: 'team_1',
        runId: 'run_1',
        review,
        threads: threadsOf(review.comments),
        composing: null,
        composerAppears: true,
        compose: vi.fn(),
      }}
    >
      {children}
    </ReviewContext>
  </QueryClientProvider>
);

const threadOf = (review: CodeReview, id: string) => {
  const thread = threadsOf(review.comments).find(({ root }) => root.id === id);

  if (!thread) {
    throw new Error(`No thread ${id}`);
  }

  return thread;
};

beforeEach(() => {
  drafting.mockReset();
  editing.mockReset();
  deleting.mockReset();
});

describe('ReviewThreadCard', () => {
  it('shows a thread with who said what and the status of each', () => {
    render(
      within_(
        REVIEW,
        <ReviewThreadCard thread={threadOf(REVIEW, 'comment_expiry')} />,
      ),
    );

    const thread = screen.getByRole('region', {
      name: 'Comments on lines 7–9',
    });
    const [first, reply] = within(thread).getAllByRole('listitem');

    expect(first).toHaveTextContent('octocat');
    expect(
      within(first as HTMLElement).getByRole('link', { name: /On GitHub/ }),
    ).toHaveAttribute(
      'href',
      'https://github.com/acme/api/pull/42#discussion_r1',
    );
    expect(reply).toHaveTextContent('You');
    expect(reply).toHaveTextContent('Sending to GitHub');
  });

  it('says a comment waits for the pull request where there is none yet', () => {
    const waiting = { ...REVIEW, pullRequest: null };

    render(
      within_(
        waiting,
        <ReviewThreadCard thread={threadOf(waiting, 'comment_expiry')} />,
      ),
    );

    expect(
      screen.getByText('Posts when the pull request opens'),
    ).toBeInTheDocument();
  });

  it('replies in the thread', async () => {
    render(
      within_(
        REVIEW,
        <ReviewThreadCard thread={threadOf(REVIEW, 'comment_expiry')} />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reply…' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Reply' }),
      'Agreed',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(drafting).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        runId: 'run_1',
        body: 'Agreed',
        on: { replyTo: 'comment_expiry' },
      },
      expect.anything(),
    );
  });

  it('keeps a draft to its author, with no replies yet', () => {
    render(
      within_(
        REVIEW,
        <ReviewThreadCard thread={threadOf(REVIEW, 'comment_roles')} />,
      ),
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reply…' }),
    ).not.toBeInTheDocument();
  });

  it('lets the author edit and delete their own comment, and nobody else’s', async () => {
    render(
      within_(
        REVIEW,
        <ReviewThreadCard thread={threadOf(REVIEW, 'comment_expiry')} />,
      ),
    );

    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleting).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        runId: 'run_1',
        commentId: 'comment_expiry_reply',
      },
      expect.anything(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByRole('textbox', { name: 'Edit the comment' });
    await userEvent.clear(box);
    await userEvent.type(box, 'They are filtered out.');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(editing).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        runId: 'run_1',
        commentId: 'comment_expiry_reply',
        body: 'They are filtered out.',
      },
      expect.anything(),
    );
  });

  it('folds a deleted comment away, and the whole thread with its last comment', async () => {
    const drafted = threadOf(REVIEW, 'comment_roles');

    render(within_(REVIEW, <ReviewThreadCard thread={drafted} />));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const thread = screen.getByRole('region', { name: 'Comments on line 6' });
    expect(thread.closest('[inert]')).not.toBeNull();
  });
});
