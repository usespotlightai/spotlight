import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import {
  latestPerPullRequest,
  pullRequestFor,
  pullRequestOfComment,
  sharedByPaths,
} from '@change-review/domain/services/pull-request-routing';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WEB = PullRequestUrl.of('https://github.com/acme/web/pull/7');
const DOCS = PullRequestUrl.of('https://github.com/acme/Docs/pull/3');
const TASK = { pullRequest: WEB, pullRequests: [WEB, DOCS] };
const ONE = { pullRequest: WEB, pullRequests: [WEB] };

const named = (name: string | null) => RepositoryName.optional(name);

describe('routing to a pull request', () => {
  it('finds the pull request of a repository by its name, in any case', () => {
    expect(pullRequestFor(TASK, named('docs'))).toBe(DOCS);
    expect(pullRequestFor(TASK, named('web'))).toBe(WEB);
  });

  it('uses the task’s first pull request for no repository, and waits for a repository without one', () => {
    expect(pullRequestFor(TASK, null)).toBe(WEB);
    expect(pullRequestFor(TASK, named('infra'))).toBeNull();
    expect(
      pullRequestFor({ pullRequest: null, pullRequests: [] }, named('web')),
    ).toBeNull();
  });

  it('sends a comment from GitHub back to the pull request it came from', () => {
    const comment = ReviewComment.receive({
      id: ReviewCommentId.of('comment_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      taskId: TaskId.of('task_1'),
      anchor: ReviewAnchor.onFile('a.ts', named('web')),
      body: 'Why?',
      author: ReviewAuthor.onGitHub('octocat'),
      inReplyTo: null,
      github: {
        id: 9,
        url: 'https://github.com/acme/Docs/pull/3#discussion_r9',
      },
      at: new Date('2026-11-01T00:00:00Z'),
    });

    expect(pullRequestOfComment(TASK, comment)?.value).toBe(DOCS.value);
  });

  it('shares items out by the repositories their paths are in, the rest on the first pull request', () => {
    const shared = sharedByPaths(
      {
        pullRequest: WEB,
        pullRequests: [
          WEB,
          DOCS,
          PullRequestUrl.of('https://github.com/acme/api/pull/1'),
        ],
      },
      [
        { id: 'both', paths: ['web/a.ts', 'docs/a.md'] },
        { id: 'docs', paths: ['docs/b.md'] },
        { id: 'elsewhere', paths: ['infra/main.tf'] },
      ],
      (each) => each.paths,
    );

    expect(
      shared.map(({ pullRequest, items }) => [
        pullRequest.value,
        items.map((each) => each.id),
      ]),
    ).toEqual([
      [WEB.value, ['both', 'elsewhere']],
      [DOCS.value, ['both', 'docs']],
      ['https://github.com/acme/api/pull/1', []],
    ]);
  });

  it('gives every item to a task’s only pull request', () => {
    expect(
      sharedByPaths(ONE, [{ paths: ['docs/b.md'] }], (each) => each.paths),
    ).toEqual([{ pullRequest: WEB, items: [{ paths: ['docs/b.md'] }] }]);
  });

  it('picks the newest item of each pull request’s repository', () => {
    const latest = latestPerPullRequest(
      TASK,
      [
        { id: 'infra-new', repository: 'infra' },
        { id: 'docs-new', repository: 'docs' },
        { id: 'web-old', repository: 'web' },
      ],
      (each) => named(each.repository),
    );

    expect(
      latest.map(({ pullRequest, items }) => [
        pullRequest.value,
        items.map((each) => each.id),
      ]),
    ).toEqual([
      [WEB.value, ['web-old']],
      [DOCS.value, ['docs-new']],
    ]);
  });
});
