import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const INSTALLATION_ADMINISTRATION = Symbol(
  'GITHUB_INSTALLATION_ADMINISTRATION',
);

export type InstallationAdministration =
  | 'administers'
  | 'does-not'
  | 'cannot-tell';

export interface InstallationAdministrationPort {
  of(
    installation: GitHubInstallation,
    userId: UserId,
  ): Promise<InstallationAdministration>;
}
