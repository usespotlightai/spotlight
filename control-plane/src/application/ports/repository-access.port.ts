import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';

export interface RepositoryCredential {
  readonly username: string;
  readonly password: string;
}

export const REPOSITORY_ACCESS = Symbol('REPOSITORY_ACCESS');

/**
 * Nothing this answers with is ever sent to a runner. A credential is minted
 * for one installation, so a workspace can only ever be given what opens its
 * own repositories.
 */
export interface RepositoryAccessPort {
  credential(installation: GitHubInstallation): Promise<RepositoryCredential>;
}
