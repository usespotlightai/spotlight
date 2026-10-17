import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { AgentReviews } from '@change-review/application/services/agent-reviews.service';
import type { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';

import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-18T09:00:00.000Z');
const TASK = TaskId.of('task_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const RUN = RunId.of('run_1');
const ON = { runId: RUN, taskId: TASK };

const reviewing = (
  pullRequest: string | null = 'https://github.com/acme/api/pull/7',
  reviewsIt = pullRequest !== null,
) => {
  const comments = new Map<string, ReviewComment>();
  const reviews: Review[] = [];
  let ids = 0;

  const task: ReviewedTask = {
    id: TASK,
    workspaceId: WORKSPACE,
    teamId: null,
    pullRequest: pullRequest ? PullRequestUrl.of(pullRequest) : null,
    reviewing: reviewsIt,
    currentRunId: null,
  };

  const agent = new AgentReviews(
    { task: async () => task } as unknown as WorkPort,
    {
      add: async (comment: ReviewComment) =>
        void comments.set(comment.id.value, comment),
      save: async (comment: ReviewComment) =>
        void comments.set(comment.id.value, comment),
      draftsBy: async (_task: TaskId, author: ReviewAuthor) =>
        [...comments.values()].filter(
          (each) => each.state === 'draft' && author.isSameAs(each.author),
        ),
    } as unknown as ReviewCommentRepository,
    {
      add: async (review: Review) => void reviews.push(review),
    } as unknown as ReviewRepository,
    { inTransaction: (work) => work() },
    { generate: () => `id_${++ids}` },
    { now: () => NOW, sleep: async () => {} },
  );

  return { agent, comments, reviews };
};

const LEFT = {
  path: '/src/upload.ts',
  line: 12,
  startLine: 9,
  side: 'new',
  body: 'This gives up after one try.',
};

describe('AgentReviews', () => {
  it('keeps a comment the agent leaves as its draft, written by the run', async () => {
    const { agent, comments } = reviewing();

    const id = await agent.comment(ON, LEFT);
    const left = comments.get(id);

    expect(left?.state).toBe('draft');
    expect(left?.anchor).toEqual(
      ReviewAnchor.onLines({
        path: 'src/upload.ts',
        side: 'new',
        line: 12,
        startLine: 9,
      }),
    );
    expect(left?.author.userId).toBeNull();
    expect(left?.author.runId?.equals(RUN)).toBe(true);
    expect(left?.author.name.value).toBe('Spotlight');
    expect(left?.byAgent).toBe(true);
  });

  it('submits the run’s own drafts as one review, and nobody else’s', async () => {
    const { agent, comments, reviews } = reviewing();
    const ada = ReviewComment.draft({
      id: ReviewCommentId.of('comment_ada'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor: ReviewAnchor.onLines({ path: 'src/a.ts', side: 'new', line: 1 }),
      body: 'Mine',
      author: ReviewAuthor.person(UserId.of('user_ada'), AuthorName.of('Ada')),
      now: NOW,
    });
    comments.set(ada.id.value, ada);

    const left = await agent.comment(ON, LEFT);
    const id = await agent.submit(ON, {
      verdict: 'request-changes',
      body: 'Uploads still give up.',
    });

    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.id.value).toBe(id);
    expect(reviews[0]?.verdict).toBe('request-changes');
    expect(reviews[0]?.author.runId?.equals(RUN)).toBe(true);
    expect(reviews[0]?.author.name.value).toBe('Spotlight');
    expect(reviews[0]?.comments.map((each) => each.value)).toEqual([left]);
    expect(comments.get(left)?.state).toBe('submitted');
    expect(comments.get('comment_ada')?.state).toBe('draft');
  });

  it('submits what an earlier run left unsubmitted along with its own', async () => {
    const { agent, reviews } = reviewing();

    const earlier = await agent.comment(
      { ...ON, runId: RunId.of('run_0') },
      LEFT,
    );
    const own = await agent.comment(ON, { ...LEFT, line: 20 });
    await agent.submit(ON, { verdict: 'comment', body: 'Two things.' });

    expect(reviews[0]?.comments.map((each) => each.value)).toEqual([
      earlier,
      own,
    ]);
  });

  it('refuses a comment where the task has no pull request to review', async () => {
    const { agent } = reviewing(null);

    await expect(agent.comment(ON, LEFT)).rejects.toThrow(InvalidReviewError);
    await expect(
      agent.submit(ON, { verdict: 'comment', body: 'Fine.' }),
    ).rejects.toThrow(InvalidReviewError);
  });

  it('refuses a comment on a pull request its task opened rather than reviews', async () => {
    const { agent } = reviewing('https://github.com/acme/api/pull/7', false);

    await expect(agent.comment(ON, LEFT)).rejects.toThrow(InvalidReviewError);
  });

  it('refuses a verdict it does not know, or a review that says nothing', async () => {
    const { agent } = reviewing();

    await expect(
      agent.submit(ON, { verdict: 'merge', body: 'Ship it' }),
    ).rejects.toThrow(InvalidReviewError);
    await expect(
      agent.submit(ON, { verdict: 'comment', body: '' }),
    ).rejects.toThrow(InvalidReviewError);
  });
});
