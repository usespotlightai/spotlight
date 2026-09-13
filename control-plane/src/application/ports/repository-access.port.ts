import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';

export interface RepositoryCredential {
  readonly username: string;
  readonly password: string;
}

export const REPOSITORY_ACCESS = Symbol('REPOSITORY_ACCESS');

export interface RepositoryAccessPort {
  // Never send this credential to a runner.
  credential(installation: GitHubInstallation): Promise<RepositoryCredential>;
}
