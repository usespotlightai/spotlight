import type { ReceivedReviewComment } from '@change-review/application/contracts/received-review-comment.contract';
import { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-16T10:00:00Z');
const WORKSPACE = WorkspaceId.of('workspace_1');
const TASK = TaskId.of('task_1');

const noticed = (
  over: Partial<ReceivedReviewComment['comment']> = {},
  action: ReceivedReviewComment['action'] = 'created',
): ReceivedReviewComment => ({
  action,
  workspaceId: WORKSPACE,
  pullRequest: 'https://github.com/acme/web/pull/7',
  comment: {
    id: 300,
    url: 'https://github.com/acme/web/pull/7#discussion_r300',
    path: 'src/a.ts',
    side: 'new',
    line: 12,
    startLine: null,
    body: 'Why not a constant?',
    answers: null,
    login: 'octocat',
    writtenAt: new Date('2026-09-16T09:00:00Z'),
    ...over,
  },
});

const receiving = (held: ReviewComment[] = []) => {
  const comments = new Map(held.map((each) => [each.id.value, each]));
  let generated = 0;

  const repository = {
    add: async (comment: ReviewComment) =>
      void comments.set(comment.id.value, comment),
    save: async (comment: ReviewComment) =>
      void comments.set(comment.id.value, comment),
    onGitHub: async (_: WorkspaceId, githubId: number) =>
      [...comments.values()].find((each) => each.github?.id === githubId) ??
      null,
    ofTask: async () => [...comments.values()],
  } as unknown as ReviewCommentRepository;

  const service = new ReceiveReviewComment(
    {
      run: async () => null,
      wasWorkedBy: async () => false,
      task: async () => null,
      taskWithPullRequest: async (workspaceId, pullRequest) => ({
        id: TASK,
        workspaceId,
        teamId: null,
        pullRequest,
      }),
    },
    repository,
    { run: (work) => work() },
    { generate: () => `comment_new_${++generated}` },
    { now: () => NOW, sleep: async () => {} },
  );

  return { service, comments };
};

const onGitHub = (githubId: number, body = 'Earlier') =>
  ReviewComment.arrived({
    id: ReviewCommentId.of(`comment_${githubId}`),
    workspaceId: WORKSPACE,
    taskId: TASK,
    anchor: ReviewAnchor.of({ path: 'src/a.ts', side: 'new', line: 12 }),
    body,
    author: { userId: null, login: 'octocat', name: 'octocat' },
    replyTo: null,
    github: { id: githubId, url: `https://github.com/c/${githubId}` },
    at: NOW,
  });

describe('ReceiveReviewComment', () => {
  it('keeps a comment made on GitHub, on its line', async () => {
    const { service, comments } = receiving();

    await service.receive(noticed({ side: 'old' }));

    const [kept] = [...comments.values()];
    expect(kept?.state).toBe('posted');
    expect(kept?.anchor.side).toBe('old');
    expect(kept?.anchor.line).toBe(12);
    expect(kept?.author).toEqual({
      userId: null,
      login: 'octocat',
      name: 'octocat',
    });
    expect(kept?.github?.id).toBe(300);
  });

  it('threads a reply under the comment it answers', async () => {
    const { service, comments } = receiving([onGitHub(200)]);

    await service.receive(noticed({ answers: 200 }));

    expect(comments.get('comment_new_1')?.replyTo?.value).toBe('comment_200');
  });

  it('keeps nothing twice', async () => {
    const { service, comments } = receiving([onGitHub(300)]);

    await service.receive(noticed());

    expect(comments.size).toBe(1);
  });

  it('ignores the echo of a comment edited while Spotlight was posting it', async () => {
    const posting = ReviewComment.drafted({
      id: ReviewCommentId.of('comment_mine'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor: ReviewAnchor.of({ path: 'src/a.ts', side: 'new', line: 12 }),
      body: 'Why not a constant?',
      author: { userId: UserId.of('user_ada'), login: null, name: 'Ada' },
      now: NOW,
    })
      .submittedIn(ReviewId.of('review_1'))
      .rewritten('Why not an enum?', UserId.of('user_ada'), NOW);
    const { service, comments } = receiving([posting]);

    await service.receive(
      noticed({ body: '**Ada** via Spotlight:\n\nWhy not a constant?' }),
    );

    expect(comments.size).toBe(1);
  });

  it('ignores the echo of a comment Spotlight is posting itself', async () => {
    const posting = ReviewComment.drafted({
      id: ReviewCommentId.of('comment_mine'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor: ReviewAnchor.of({ path: 'src/a.ts', side: 'new', line: 12 }),
      body: 'Why not a constant?',
      author: { userId: UserId.of('user_ada'), login: null, name: 'Ada' },
      now: NOW,
    }).submittedIn(ReviewId.of('review_1'));
    const { service, comments } = receiving([posting]);

    await service.receive(
      noticed({ body: '**Ada** via Spotlight:\n\nWhy not a constant?' }),
    );

    expect(comments.size).toBe(1);
  });

  it('follows an edit and a deletion made on GitHub', async () => {
    const { service, comments } = receiving([onGitHub(300)]);

    await service.receive(noticed({ body: 'Rewritten' }, 'edited'));
    expect(comments.get('comment_300')?.body).toBe('Rewritten');

    await service.receive(noticed({}, 'deleted'));
    expect(comments.get('comment_300')?.state).toBe('deleted');
  });

  it('keeps an edit made in Spotlight when the echo of an earlier one arrives', async () => {
    const mine = ReviewComment.drafted({
      id: ReviewCommentId.of('comment_mine'),
      workspaceId: WORKSPACE,
      taskId: TASK,
      anchor: ReviewAnchor.of({ path: 'src/a.ts', side: 'new', line: 12 }),
      body: 'Why not a constant?',
      author: { userId: UserId.of('user_ada'), login: null, name: 'Ada' },
      now: NOW,
    })
      .submittedIn(ReviewId.of('review_1'))
      .postedAs({ id: 300, url: 'https://github.com/c/300' })
      .rewritten('First', UserId.of('user_ada'), NOW)
      .editSent('First')
      .rewritten('Second', UserId.of('user_ada'), NOW);
    const { service, comments } = receiving([mine]);

    await service.receive(noticed({ body: 'First' }, 'edited'));

    expect(comments.get('comment_mine')?.body).toBe('Second');
    expect(comments.get('comment_mine')?.editPending).toBe(true);
  });

  it('ignores a comment on a file rather than a line, or from a workspace it does not know', async () => {
    const unlined = receiving();
    await unlined.service.receive(noticed({ line: null }));
    expect(unlined.comments.size).toBe(0);
  });
});
