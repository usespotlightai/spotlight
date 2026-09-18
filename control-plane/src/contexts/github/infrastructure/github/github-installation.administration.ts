import type {
  InstallationAdministration,
  InstallationAdministrationPort,
} from '@github/application/ports/installation-administration.port';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { assertionFor } from '@github/infrastructure/github/app-assertion';
import { call } from '@github/infrastructure/github/github.rest';
import type { LinkedAccountsPort } from '@identity/application/ports/linked-accounts.port';
import type { Env } from '@platform/config/env.schema';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

interface Account {
  readonly id: number;
  readonly login: string;
  readonly type: string;
}

type Looked<T> = T | 'missing' | 'failed';

export class GitHubInstallationAdministration
  implements InstallationAdministrationPort
{
  constructor(
    private readonly env: Env,
    private readonly accounts: LinkedAccountsPort,
  ) {}

  async of(
    installation: GitHubInstallation,
    userId: UserId,
  ): Promise<InstallationAdministration> {
    const token = await this.accounts.tokenFor(userId, 'github');

    if (!token) {
      return 'cannot-tell';
    }

    const account = await this.accountOf(installation);

    if (account === 'missing') {
      return 'does-not';
    }
    if (account === 'failed') {
      return 'cannot-tell';
    }

    return account.type === 'Organization'
      ? this.adminOf(account.login, token)
      : this.ownerOf(account.id, token);
  }

  private async accountOf(
    installation: GitHubInstallation,
  ): Promise<Looked<Account>> {
    const read = await this.read<{ account?: Partial<Account> | null }>(
      `/app/installations/${installation.value}`,
      assertionFor(this.env),
    );

    if (read === 'missing' || read === 'failed') {
      return read;
    }

    const { id, login, type } = read.account ?? {};

    return typeof id === 'number' &&
      typeof login === 'string' &&
      typeof type === 'string'
      ? { id, login, type }
      : 'failed';
  }

  private async adminOf(
    org: string,
    token: string,
  ): Promise<InstallationAdministration> {
    const read = await this.read<{ state?: string; role?: string }>(
      `/user/memberships/orgs/${encodeURIComponent(org)}`,
      token,
    );

    if (read === 'missing') {
      return 'does-not';
    }
    if (read === 'failed') {
      return 'cannot-tell';
    }

    return read.state === 'active' && read.role === 'admin'
      ? 'administers'
      : 'does-not';
  }

  private async ownerOf(
    accountId: number,
    token: string,
  ): Promise<InstallationAdministration> {
    const read = await this.read<{ id?: unknown }>('/user', token);

    if (
      read === 'missing' ||
      read === 'failed' ||
      typeof read.id !== 'number'
    ) {
      return 'cannot-tell';
    }

    return read.id === accountId ? 'administers' : 'does-not';
  }

  private async read<T>(path: string, token: string): Promise<Looked<T>> {
    const response = await call(path, token).catch(() => null);

    if (!response) {
      return 'failed';
    }
    if (response.status === 404) {
      return 'missing';
    }
    if (!response.ok) {
      return 'failed';
    }

    return ((await response.json().catch(() => null)) as T | null) ?? 'failed';
  }
}
