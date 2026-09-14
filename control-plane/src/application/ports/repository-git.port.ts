import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface GitCall {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly search: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: AsyncIterable<Uint8Array> | null;
}

export interface GitAnswer {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: AsyncIterable<Uint8Array> | null;
}

export const REPOSITORY_GIT = Symbol('REPOSITORY_GIT');

export interface RepositoryGitPort {
  call(
    installation: GitHubInstallation,
    repository: Repository,
    call: GitCall,
  ): Promise<GitAnswer>;
}
