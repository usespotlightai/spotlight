import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export const GITHUB_IDENTITY = Symbol('GITHUB_IDENTITY');

// 'cannot-tell' is deliberately distinct from 'does-not': GitHub declining to answer is not a refusal.
export type Administers = 'administers' | 'does-not' | 'cannot-tell';

export interface GitHubIdentityPort {
  administers(
    userId: UserId,
    installation: GitHubInstallation,
  ): Promise<Administers>;
}
