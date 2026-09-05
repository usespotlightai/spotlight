import type { GitHubAppPort } from '@application/ports/github-app.port';
import { ENV } from '@infrastructure/config/config.constants';
import type { Env } from '@infrastructure/config/env.schema';
import { assertionFor } from '@infrastructure/github/app-assertion';
import { Inject, Injectable } from '@nestjs/common';

const API = 'https://api.github.com';

/**
 * Where this App is installed from, asked of GitHub rather than configured.
 * An App's slug is settled when it is created and does not change, so it is
 * asked for once and held.
 */
@Injectable()
export class GitHubAppIdentity implements GitHubAppPort {
  #slug: string | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async installUrl(): Promise<string | null> {
    const slug = this.#slug ?? (await this.named());

    return slug && `https://github.com/apps/${slug}/installations/new`;
  }

  private async named(): Promise<string | null> {
    const response = await fetch(`${API}/app`, {
      headers: {
        authorization: `Bearer ${assertionFor(this.env)}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    }).catch(() => null);

    if (!response?.ok) {
      return null;
    }

    const app = (await response.json()) as { slug?: string };

    this.#slug = app.slug ?? null;

    return this.#slug;
  }
}
