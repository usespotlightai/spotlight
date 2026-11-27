import type {
  InstallationAdministration,
  InstallationAdministrationPort,
} from '@github/application/ports/installation-administration.port';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { appJwt } from '@github/infrastructure/github/app-jwt';
import { call } from '@github/infrastructure/github/github.rest';
import type { LinkedAccountsPort } from '@identity/application/ports/linked-accounts.port';
import type { Env } from '@platform/config/env.schema';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { z } from 'zod';

const INSTALLATION_ANSWER = z.object({
  account: z.object({ id: z.number(), login: z.string(), type: z.string() }),
});

const MEMBERSHIP_ANSWER = z.object({
  state: z.unknown().optional(),
  role: z.unknown().optional(),
});

const USER_ANSWER = z.object({ id: z.unknown().optional() });

type Account = z.infer<typeof INSTALLATION_ANSWER>['account'];

type Looked<T> = T | 'missing' | 'failed';

export class GitHubInstallationAdministration implements InstallationAdministrationPort {
  constructor(
    private readonly env: Env,
    private readonly accounts: LinkedAccountsPort,
  ) {}

  async of(
    installation: GitHubInstallation,
    userId: UserId,
  ): Promise<InstallationAdministration> {
    const token = await this.accounts.tokenFor(userId, 'github');

    if (token === null || token === '') {
      return 'unknown';
    }

    const account = await this.accountOf(installation);

    if (account === 'missing') {
      return 'not-admin';
    }
    if (account === 'failed') {
      return 'unknown';
    }

    return account.type === 'Organization'
      ? this.adminOf(account.login, token)
      : this.ownerOf(account.id, token);
  }

  private async accountOf(
    installation: GitHubInstallation,
  ): Promise<Looked<Account>> {
    const read = await this.read(
      `/app/installations/${installation.value}`,
      appJwt(this.env),
      INSTALLATION_ANSWER,
    );

    return read === 'missing' || read === 'failed' ? read : read.account;
  }

  private async adminOf(
    org: string,
    token: string,
  ): Promise<InstallationAdministration> {
    const read = await this.read(
      `/user/memberships/orgs/${encodeURIComponent(org)}`,
      token,
      MEMBERSHIP_ANSWER,
    );

    if (read === 'missing') {
      return 'not-admin';
    }
    if (read === 'failed') {
      return 'unknown';
    }

    return read.state === 'active' && read.role === 'admin'
      ? 'admin'
      : 'not-admin';
  }

  private async ownerOf(
    accountId: number,
    token: string,
  ): Promise<InstallationAdministration> {
    const read = await this.read('/user', token, USER_ANSWER);

    if (
      read === 'missing' ||
      read === 'failed' ||
      typeof read.id !== 'number'
    ) {
      return 'unknown';
    }

    return read.id === accountId ? 'admin' : 'not-admin';
  }

  private async read<T>(
    path: string,
    token: string,
    answer: z.ZodType<T>,
  ): Promise<Looked<T>> {
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

    const parsed = answer.safeParse(await response.json().catch(() => null));

    return parsed.success ? parsed.data : 'failed';
  }
}
