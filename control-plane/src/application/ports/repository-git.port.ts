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

/** Under the control plane's own credential, which the adapter holds. */
export interface RepositoryGitPort {
  call(repository: Repository, call: GitCall): Promise<GitAnswer>;
}
