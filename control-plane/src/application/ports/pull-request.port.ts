import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface OpenedPullRequestDto {
  readonly url: string;
}

export interface PullRequestOpening {
  readonly installation: GitHubInstallation;
  readonly repository: Repository;
  readonly branch: string;
  readonly title: string;
  readonly body: string;
}

export const PULL_REQUESTS = Symbol('PULL_REQUESTS');

export interface PullRequestPort {
  open(opening: PullRequestOpening): Promise<OpenedPullRequestDto>;
}
