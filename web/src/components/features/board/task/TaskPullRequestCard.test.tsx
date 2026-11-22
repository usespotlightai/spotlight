import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskPullRequestCard } from '@/components/features/board/task/TaskPullRequestCard';
import type { TaskPullRequest } from '@/lib/pull-request-state';

const URL = 'https://github.com/acme/api/pull/770';

const MERGED: TaskPullRequest = {
  url: URL,
  state: 'merged',
  title: 'feat: suspend workspace members',
  author: 'octocat',
  authorImage: 'https://github.com/octocat.png?size=64',
  additions: 3813,
  deletions: 64786,
  changedFiles: 105,
  updatedAt: '2026-11-21T16:00:00.000Z',
};

const UNSEEN: TaskPullRequest = {
  url: URL,
  state: null,
  title: null,
  author: null,
  authorImage: null,
  additions: null,
  deletions: null,
  changedFiles: null,
  updatedAt: null,
};

describe('TaskPullRequestCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-11-22T12:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the title, repository, author, age, size and state', () => {
    render(<TaskPullRequestCard pullRequest={MERGED} />);

    expect(
      screen.getByText('feat: suspend workspace members'),
    ).toBeInTheDocument();
    expect(screen.getByText('acme/api #770')).toBeInTheDocument();
    expect(screen.getByText('octocat')).toBeInTheDocument();
    expect(screen.getByText('20h ago')).toBeInTheDocument();
    expect(screen.getByText('+3813')).toBeInTheDocument();
    expect(screen.getByText('−64786')).toBeInTheDocument();
    expect(screen.getByText('105 files')).toBeInTheDocument();
    expect(screen.getByText('Merged')).toBeInTheDocument();
  });

  it('shows only the repository and number while GitHub has told nothing', () => {
    const { container } = render(<TaskPullRequestCard pullRequest={UNSEEN} />);

    expect(container).toHaveTextContent(/^acme\/api #770$/);
  });

  it('says file for a single changed file', () => {
    render(
      <TaskPullRequestCard pullRequest={{ ...MERGED, changedFiles: 1 }} />,
    );

    expect(screen.getByText('1 file')).toBeInTheDocument();
  });
});
