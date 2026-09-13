import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';

export const GITHUB_APP = Symbol('GITHUB_APP');

export interface GitHubAppPort {
  installUrl(): Promise<string | null>;

  owner(installation: GitHubInstallation): Promise<string | null>;
}
