import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { Review } from '@change-review/domain/aggregates/review.aggregate';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { WorkingCopyPath } from '@change-review/domain/value-objects/working-copy-path.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export interface TaskPullRequests {
  readonly pullRequest: PullRequestUrl | null;
  readonly pullRequests: readonly PullRequestUrl[];
}

export interface PullRequestShare<T> {
  readonly pullRequest: PullRequestUrl;
  readonly items: readonly T[];
}

export const pullRequestsOf = (
  task: TaskPullRequests,
): readonly PullRequestUrl[] =>
  task.pullRequests.length > 0
    ? task.pullRequests
    : task.pullRequest
      ? [task.pullRequest]
      : [];

export const pullRequestFor = (
  task: TaskPullRequests,
  repository: RepositoryName | null,
): PullRequestUrl | null =>
  repository
    ? (pullRequestsOf(task).find((each) => repository.isOf(each)) ?? null)
    : task.pullRequest;

export const pullRequestOfReview = (
  task: TaskPullRequests,
  review: Review,
): PullRequestUrl | null => pullRequestFor(task, review.repository);

export const pullRequestOfComment = (
  task: TaskPullRequests,
  comment: ReviewComment,
): PullRequestUrl | null =>
  comment.pullRequestOnGitHub ??
  pullRequestFor(task, comment.anchor.repository);

const touches = (pullRequest: PullRequestUrl, paths: readonly string[]) => {
  const repository = pullRequest.repository;

  return (
    repository !== null &&
    paths.some((path) => WorkingCopyPath.of(path).isWithin(repository))
  );
};

export const sharedByPaths = <T>(
  task: TaskPullRequests,
  items: readonly T[],
  pathsOf: (item: T) => readonly string[],
): PullRequestShare<T>[] => {
  const first = task.pullRequest;

  if (!first) {
    return [];
  }
  const all = pullRequestsOf(task);

  if (all.length <= 1) {
    return [{ pullRequest: first, items }];
  }

  const placed = items.map((item) => {
    const on = all.filter((each) => touches(each, pathsOf(item)));

    return { item, on: on.length > 0 ? on : [first] };
  });

  return all.map((pullRequest) => ({
    pullRequest,
    items: placed
      .filter(({ on }) => on.some((each) => each.equals(pullRequest)))
      .map(({ item }) => item),
  }));
};

export const latestPerPullRequest = <T>(
  task: TaskPullRequests,
  newestFirst: readonly T[],
  repositoryOf: (item: T) => RepositoryName | null,
): PullRequestShare<T>[] =>
  pullRequestsOf(task).flatMap((pullRequest) => {
    const latest =
      newestFirst.find((each) => repositoryOf(each)?.isOf(pullRequest)) ??
      newestFirst.find((each) =>
        pullRequestFor(task, repositoryOf(each))?.equals(pullRequest),
      );

    return latest ? [{ pullRequest, items: [latest] }] : [];
  });
