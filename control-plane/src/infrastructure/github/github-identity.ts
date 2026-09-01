import type { GitHubIdentityPort } from '@application/ports/github-identity.port';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { account } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

const API = 'https://api.github.com';
const PROVIDER = 'github';
const PER_PAGE = 100;

/** As many installations as one person is ever an administrator of. */
const MAX_PAGES = 5;

interface Listed {
  readonly installations?: readonly { readonly id?: unknown }[];
}

@Injectable()
export class GitHubIdentity implements GitHubIdentityPort {
  constructor(private readonly context: DrizzleContext) {}

  async administers(
    userId: UserId,
    installation: GitHubInstallation,
  ): Promise<boolean> {
    const token = await this.tokenFor(userId);

    // Signed in through something other than GitHub, or signed in long enough
    // ago that the token has gone: nothing here can be shown, so nothing is.
    if (!token) {
      return false;
    }

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const held = await this.page(token, page);

      if (held === null) {
        return false;
      }
      if (held.some((each) => each === installation.value)) {
        return true;
      }
      if (held.length < PER_PAGE) {
        return false;
      }
    }

    return false;
  }

  private async tokenFor(userId: UserId): Promise<string | null> {
    const [found] = await this.context.db
      .select({ token: account.accessToken })
      .from(account)
      .where(
        and(eq(account.userId, userId.value), eq(account.providerId, PROVIDER)),
      )
      .limit(1);

    return found?.token ?? null;
  }

  /** The ids on one page, or null where GitHub would not answer at all. */
  private async page(token: string, page: number): Promise<string[] | null> {
    const response = await fetch(
      `${API}/user/installations?per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const listed = (await response.json()) as Listed;

    return (listed.installations ?? []).flatMap((each) =>
      typeof each.id === 'number' || typeof each.id === 'string'
        ? [String(each.id)]
        : [],
    );
  }
}
