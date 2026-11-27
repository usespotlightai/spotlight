import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const REACHABLE_INSTALLATIONS = Symbol('GITHUB_REACHABLE_INSTALLATIONS');

export interface ReachableInstallation {
  readonly installation: GitHubInstallation;
  readonly account: string;
}

export interface ReachableInstallationsPort {
  of(userId: UserId): Promise<ReachableInstallation[]>;
}
