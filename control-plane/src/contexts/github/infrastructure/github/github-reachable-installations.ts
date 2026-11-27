import type {
  ReachableInstallation,
  ReachableInstallationsPort,
} from '@github/application/ports/reachable-installations.port';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { answered, call } from '@github/infrastructure/github/github.rest';
import type { LinkedAccountsPort } from '@identity/application/ports/linked-accounts.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const PER_PAGE = 100;

const MAX_PAGES = 10;

interface Listed {
  readonly installations?: {
    readonly id?: unknown;
    readonly account?: { readonly login?: unknown } | null;
  }[];
}

export class GitHubReachableInstallations implements ReachableInstallationsPort {
  constructor(private readonly accounts: LinkedAccountsPort) {}

  async of(userId: UserId): Promise<ReachableInstallation[]> {
    const token = await this.accounts.tokenFor(userId, 'github');

    if (!token) {
      return [];
    }

    const found: ReachableInstallation[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const listed = (await this.page(token, page)).installations ?? [];

      found.push(
        ...listed.flatMap(({ id, account }) => {
          const installation =
            typeof id === 'number'
              ? GitHubInstallation.parsed(String(id))
              : null;

          return installation && typeof account?.login === 'string'
            ? [{ installation, account: account.login }]
            : [];
        }),
      );

      if (listed.length < PER_PAGE) {
        break;
      }
    }

    return found.sort((one, other) => one.account.localeCompare(other.account));
  }

  private async page(token: string, page: number): Promise<Listed> {
    const path = `/user/installations?per_page=${PER_PAGE}&page=${page}`;

    return answered<Listed>(await call(path, token), `GET ${path}`);
  }
}
