import type { GitHubAppPort } from '@github/application/ports/github-app.port';
import { appJwt } from '@github/infrastructure/github/app-jwt';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { z } from 'zod';

const API = 'https://api.github.com';

const APP = z.object({ slug: z.string().optional() });

@Injectable()
export class GitHubAppIdentity implements GitHubAppPort {
  #slug: string | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async installUrl(): Promise<string | null> {
    const slug = this.#slug ?? (await this.named());

    return slug === null || slug === ''
      ? slug
      : `https://github.com/apps/${slug}/installations/new`;
  }

  private async named(): Promise<string | null> {
    const response = await fetch(`${API}/app`, {
      headers: {
        authorization: `Bearer ${appJwt(this.env)}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    }).catch(() => null);

    if (response?.ok !== true) {
      return null;
    }

    const app = APP.safeParse(await response.json());

    this.#slug = app.success ? (app.data.slug ?? null) : null;

    return this.#slug;
  }
}
