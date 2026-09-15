import type {
  Administers,
  GitHubIdentityPort,
} from '@application/ports/github-identity.port';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { account } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import { and, eq } from 'drizzle-orm';

const API = 'https://api.github.com';
const REFRESH = 'https://github.com/login/oauth/access_token';
const PROVIDER = 'github';
const PER_PAGE = 100;

const MAX_PAGES = 5;

const SKEW_MS = 60_000;

interface Listed {
  readonly installations?: readonly { readonly id?: unknown }[];
}

interface Held {
  readonly id: string;
  readonly token: string | null;
  readonly refresh: string | null;
  readonly expiresAt: Date | null;
}

interface Refreshed {
  readonly access_token?: string;
  readonly expires_in?: number;
  readonly refresh_token?: string;
  readonly refresh_token_expires_in?: number;
  readonly error?: string;
}

export class GitHubIdentity implements GitHubIdentityPort {
  // Root connection, not the caller's transaction: a spent refresh must persist.
  constructor(
    private readonly db: DrizzleDatabase,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  async administers(
    userId: UserId,
    installation: GitHubInstallation,
  ): Promise<Administers> {
    const token = await this.tokenFor(userId);

    if (!token) {
      return 'cannot-tell';
    }

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const held = await this.page(token, page);

      if (held === null) {
        return 'cannot-tell';
      }
      if (held.some((each) => each === installation.value)) {
        return 'administers';
      }
      if (held.length < PER_PAGE) {
        return 'does-not';
      }
    }

    return 'cannot-tell';
  }

  private async tokenFor(userId: UserId): Promise<string | null> {
    const [held] = await this.db
      .select({
        id: account.id,
        token: account.accessToken,
        refresh: account.refreshToken,
        expiresAt: account.accessTokenExpiresAt,
      })
      .from(account)
      .where(
        and(eq(account.userId, userId.value), eq(account.providerId, PROVIDER)),
      )
      .limit(1);

    if (!held?.token) {
      return null;
    }
    if (!GitHubIdentity.hasExpired(held.expiresAt)) {
      return held.token;
    }

    return held.refresh ? this.refresh(held as Held) : held.token;
  }

  private static hasExpired(at: Date | null): boolean {
    return at !== null && at.getTime() - SKEW_MS <= Date.now();
  }

  private async refresh(held: Held): Promise<string | null> {
    const response = await fetch(REFRESH, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: held.refresh,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as Refreshed;

    if (body.error || !body.access_token) {
      return null;
    }

    const now = Date.now();

    await this.db
      .update(account)
      .set({
        accessToken: body.access_token,
        accessTokenExpiresAt: body.expires_in
          ? new Date(now + body.expires_in * 1000)
          : null,
        refreshToken: body.refresh_token ?? held.refresh,
        refreshTokenExpiresAt: body.refresh_token_expires_in
          ? new Date(now + body.refresh_token_expires_in * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(account.id, held.id));

    return body.access_token;
  }

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
