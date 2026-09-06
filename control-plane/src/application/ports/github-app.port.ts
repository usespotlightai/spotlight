import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';

export const GITHUB_APP = Symbol('GITHUB_APP');

export interface GitHubAppPort {
  /**
   * Where a person goes to install it, or null where GitHub would not say
   * what the App is called. Nothing depends on it but a link.
   */
  installUrl(): Promise<string | null>;

  /**
   * The account an installation is on, under which its repositories are named
   * and new ones are made. Asked of the App as itself, so it holds before the
   * installation has been given a single repository. Null where GitHub would
   * not say whose it is.
   */
  owner(installation: GitHubInstallation): Promise<string | null>;
}
