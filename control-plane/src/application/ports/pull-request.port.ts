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

/** A file as Spotlight would have it, whether or not the branch has one. */
export interface WrittenFile {
  readonly path: string;
  readonly text: string;
}

export interface PullRequestProposal extends PullRequestOpening {
  /** Written in one commit, so the branch never exists half-changed. */
  readonly files: readonly WrittenFile[];
  /** Paths to take away, in the same commit as whatever is written. */
  readonly removes?: readonly string[];
  readonly message: string;
}

export const PULL_REQUESTS = Symbol('PULL_REQUESTS');

export interface PullRequestPort {
  /** For a branch a run has already pushed. */
  open(opening: PullRequestOpening): Promise<OpenedPullRequestDto>;

  /**
   * For a change Spotlight itself is making, where there is no run and no
   * working copy: the branch, the commit and the pull request are all made
   * from here. Opened against the branch as it stands where one is already
   * open, so proposing twice amends rather than collides.
   */
  propose(proposal: PullRequestProposal): Promise<OpenedPullRequestDto>;
}
