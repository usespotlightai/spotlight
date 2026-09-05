import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export const GITHUB_IDENTITY = Symbol('GITHUB_IDENTITY');

/**
 * What GitHub said when asked whether an installation is this person's.
 *
 * 'cannot-tell' is kept apart from 'no' on purpose. A token GitHub will not
 * answer for is not a person who administers nothing, and telling somebody
 * the installation is not theirs when nobody ever asked is how an afternoon
 * gets lost.
 */
export type Administers = 'administers' | 'does-not' | 'cannot-tell';

/**
 * What a signed-in person is on GitHub, asked of GitHub rather than taken on
 * their word. Anyone can name an installation number; only whoever the App
 * was installed by can be shown to hold one.
 */
export interface GitHubIdentityPort {
  administers(
    userId: UserId,
    installation: GitHubInstallation,
  ): Promise<Administers>;
}
