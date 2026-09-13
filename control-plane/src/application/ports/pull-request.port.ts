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

export interface WrittenFile {
  readonly path: string;
  readonly text: string;
}

export interface PullRequestProposal extends PullRequestOpening {
  readonly files: readonly WrittenFile[];
  readonly removes?: readonly string[];
  readonly message: string;
}

export const PULL_REQUESTS = Symbol('PULL_REQUESTS');

export interface PullRequestPort {
  open(opening: PullRequestOpening): Promise<OpenedPullRequestDto>;

  propose(proposal: PullRequestProposal): Promise<OpenedPullRequestDto>;

  openFor(
    installation: GitHubInstallation,
    repository: Repository,
    branch: string,
  ): Promise<OpenedPullRequestDto | null>;
}
