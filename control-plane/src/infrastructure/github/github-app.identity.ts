import type { GitHubAppPort } from '@application/ports/github-app.port';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { ENV } from '@infrastructure/config/config.constants';
import type { Env } from '@infrastructure/config/env.schema';
import { assertionFor } from '@infrastructure/github/app-assertion';
import { Inject, Injectable } from '@nestjs/common';

const API = 'https://api.github.com';

@Injectable()
export class GitHubAppIdentity implements GitHubAppPort {
  #slug: string | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async installUrl(): Promise<string | null> {
    const slug = this.#slug ?? (await this.named());

    return slug && `https://github.com/apps/${slug}/installations/new`;
  }

  async owner(installation: GitHubInstallation): Promise<string | null> {
    const response = await fetch(
      `${API}/app/installations/${installation.value}`,
      {
        headers: {
          authorization: `Bearer ${assertionFor(this.env)}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
        },
      },
    ).catch(() => null);

    if (!response?.ok) {
      return null;
    }

    const read = (await response.json()) as { account?: { login?: string } };

    return read.account?.login ?? null;
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
