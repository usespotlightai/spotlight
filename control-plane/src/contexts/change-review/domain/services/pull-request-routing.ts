import type { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { Review } from '@change-review/domain/aggregates/review.aggregate';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { WorkingCopyPath } from '@change-review/domain/value-objects/working-copy-path.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export interface TaskPullRequests {
  readonly pullRequests: readonly PullRequestUrl[];
  readonly reviewedPullRequest: PullRequestUrl | null;
}

export interface PullRequestShare<T> {
  readonly pullRequest: PullRequestUrl;
  readonly items: readonly T[];
}

export const pullRequestsOf = (
  task: TaskPullRequests,
): readonly PullRequestUrl[] =>
  task.reviewedPullRequest ? [task.reviewedPullRequest] : task.pullRequests;

export type PullRequestRoute =
  | { readonly kind: 'routed'; readonly pullRequest: PullRequestUrl }
  | { readonly kind: 'waiting' }
  | { readonly kind: 'ambiguous' };

export const routeFor = (
  task: TaskPullRequests,
  repository: RepositoryName | null,
): PullRequestRoute => {
  const all = pullRequestsOf(task);
  const found = repository
    ? all.find((each) => repository.isOf(each))
    : all.length === 1
      ? all[0]
      : undefined;

  if (found) {
    return { kind: 'routed', pullRequest: found };
  }

  return !repository && all.length > 1
    ? { kind: 'ambiguous' }
    : { kind: 'waiting' };
};

export const pullRequestFor = (
  task: TaskPullRequests,
  repository: RepositoryName | null,
): PullRequestUrl | null => {
  const route = routeFor(task, repository);

  return route.kind === 'routed' ? route.pullRequest : null;
};

export interface PullRequestLanding {
  readonly repository: RepositoryName | null;
  readonly route: PullRequestRoute;
}

export const landingsOf = (
  task: TaskPullRequests,
): readonly PullRequestLanding[] => [
  { repository: null, route: routeFor(task, null) },
  ...pullRequestsOf(task).flatMap((pullRequest) => {
    const repository = RepositoryName.ofPullRequest(pullRequest);

    return repository
      ? [{ repository, route: routeFor(task, repository) }]
      : [];
  }),
];

export const routeOfReview = (
  task: TaskPullRequests,
  review: Review,
): PullRequestRoute => routeFor(task, review.repository);

export const routeOfComment = (
  task: TaskPullRequests,
  comment: ReviewComment,
): PullRequestRoute => {
  const onGitHub = comment.pullRequestOnGitHub;

  return onGitHub
    ? { kind: 'routed', pullRequest: onGitHub }
    : routeFor(task, comment.anchor.repository);
};

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
  const all = pullRequestsOf(task);
  const [first] = all;

  if (!first) {
    return [];
  }

  if (all.length === 1) {
    return [{ pullRequest: first, items }];
  }

  const placed = items.map((item) => ({
    item,
    on: all.filter((each) => touches(each, pathsOf(item))),
  }));

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
