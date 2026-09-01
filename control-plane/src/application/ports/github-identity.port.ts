import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export const GITHUB_IDENTITY = Symbol('GITHUB_IDENTITY');

/**
 * What a signed-in person is on GitHub, asked of GitHub rather than taken on
 * their word. Anyone can name an installation number; only whoever the App
 * was installed by can be shown to hold one.
 */
export interface GitHubIdentityPort {
  /**
   * True where this person administers that installation. False for one that
   * is not theirs, and for a person GitHub no longer recognises.
   */
  administers(
    userId: UserId,
    installation: GitHubInstallation,
  ): Promise<boolean>;
}
