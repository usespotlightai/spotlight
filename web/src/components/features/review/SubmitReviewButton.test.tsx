import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubmitReviewButton } from '@/components/features/review/SubmitReviewButton';
import { type CodeReview, threadsOf } from '@/lib/review';
import { ReviewContext } from '@/lib/review-context';
import { REVIEW } from '@/test/fixtures/change-stack';

const submitting = vi.fn();

vi.mock('@/hooks/api/useSubmitReview', () => ({
  useSubmitReview: () => ({
    mutate: submitting,
    isPending: false,
  }),
}));

const renderWith = (review: CodeReview, repository: string | null = null) =>
  render(
    <ReviewContext
      value={{
        teamId: 'team_1',
        runId: 'run_1',
        repository,
        review,
        threads: threadsOf(review.comments),
        composing: null,
        composerAppears: true,
        compose: vi.fn(),
      }}
    >
      <SubmitReviewButton />
    </ReviewContext>,
  );

beforeEach(() => submitting.mockReset());

describe('SubmitReviewButton', () => {
  it('counts the drafts waiting to be submitted', () => {
    renderWith(REVIEW);

    expect(
      screen.getByRole('button', { name: /Finish review/ }),
    ).toHaveTextContent('1');
  });

  it('submits the drafts with a verdict and summary', async () => {
    renderWith(REVIEW);

    await userEvent.click(
      screen.getByRole('button', { name: /Finish review/ }),
    );
    expect(
      screen.getByText('Spotlight posts 1 comment to the pull request.'),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Review summary' }),
      'One thing on roles',
    );
    await userEvent.click(
      screen.getByRole('radio', { name: /Request changes/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Submit review' }),
    );

    expect(submitting).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        runId: 'run_1',
        repository: null,
        verdict: 'request-changes',
        body: 'One thing on roles',
      },
      expect.anything(),
    );
  });

  it('submits the review for the repository on screen', async () => {
    renderWith(REVIEW, 'docs');

    await userEvent.click(
      screen.getByRole('button', { name: /Finish review/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Submit review' }),
    );

    expect(submitting).toHaveBeenCalledWith(
      expect.objectContaining({ repository: 'docs', verdict: 'comment' }),
      expect.anything(),
    );
  });

  it('says the review waits for the pull request where there is none', async () => {
    renderWith({
      ...REVIEW,
      landings: [{ repository: null, route: 'waiting', pullRequest: null }],
    });

    await userEvent.click(
      screen.getByRole('button', { name: /Finish review/ }),
    );

    expect(
      screen.getByText(
        'When the task opens its pull request, Spotlight posts 1 comment.',
      ),
    ).toBeInTheDocument();
  });

  it('says the review names no repository where the task has several pull requests', async () => {
    renderWith({
      ...REVIEW,
      landings: [{ repository: null, route: 'ambiguous', pullRequest: null }],
    });

    await userEvent.click(
      screen.getByRole('button', { name: /Finish review/ }),
    );

    expect(
      screen.getByText(
        'The task has more than one pull request. The review names no repository.',
      ),
    ).toBeInTheDocument();
  });

  it('will not submit a comment that says nothing', async () => {
    renderWith({ ...REVIEW, comments: [] });

    await userEvent.click(
      screen.getByRole('button', { name: /Finish review/ }),
    );

    expect(
      screen.getByRole('button', { name: 'Submit review' }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole('radio', { name: /Approve/ }));
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeEnabled();
  });
});
