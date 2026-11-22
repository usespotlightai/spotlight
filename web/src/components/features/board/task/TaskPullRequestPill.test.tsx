import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TaskPullRequestPill } from '@/components/features/board/task/TaskPullRequestPill';
import type { TaskPullRequest } from '@/lib/pull-request-state';

const PULL_REQUEST: TaskPullRequest = {
  url: 'https://github.com/acme/api/pull/770',
  state: 'merged',
  title: 'feat: suspend workspace members',
  author: 'octocat',
  authorImage: null,
  additions: 3813,
  deletions: 64786,
  changedFiles: 105,
  updatedAt: '2026-11-21T16:00:00.000Z',
};

describe('TaskPullRequestPill', () => {
  it('links to the pull request', () => {
    render(<TaskPullRequestPill pullRequest={PULL_REQUEST} />);

    expect(
      screen.getByRole('link', {
        name: 'Pull request 770 in acme/api, merged',
      }),
    ).toHaveAttribute('href', PULL_REQUEST.url);
  });

  it('shows the pull request card while you hover the pill', async () => {
    const user = userEvent.setup();
    render(<TaskPullRequestPill pullRequest={PULL_REQUEST} />);

    expect(
      screen.queryByText('feat: suspend workspace members'),
    ).not.toBeInTheDocument();

    await user.hover(screen.getByRole('link'));

    expect(
      await screen.findByText('feat: suspend workspace members', undefined, {
        timeout: 2000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('105 files')).toBeInTheDocument();
  });
});
