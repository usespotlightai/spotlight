import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TaskPullRequestLink } from '@/components/features/board/task/TaskPullRequestLink';

const DOCS = 'https://github.com/acme/docs/pull/3';

describe('TaskPullRequestLink', () => {
  it('links to the pull request', () => {
    render(<TaskPullRequestLink href={DOCS} named={false} />);

    expect(screen.getByRole('link', { name: 'Pull request' })).toHaveAttribute(
      'href',
      DOCS,
    );
  });

  it('names the repository where the task has several', () => {
    render(<TaskPullRequestLink href={DOCS} named />);

    expect(
      screen.getByRole('link', { name: 'Pull request in acme/docs' }),
    ).toHaveAttribute('href', DOCS);
  });
});
