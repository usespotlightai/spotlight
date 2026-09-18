import type { GitHubAppPort } from '@github/application/ports/github-app.port';
import type { InstallationsPort } from '@github/application/ports/installations.port';
import { assertionFor } from '@github/infrastructure/github/app-assertion';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const API = 'https://api.github.com';

@Injectable()
export class GitHubAppIdentity implements GitHubAppPort {
  #slug: string | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly installations: InstallationsPort,
  ) {}

  async installUrl(): Promise<string | null> {
    const slug = this.#slug ?? (await this.named());

    return slug && `https://github.com/apps/${slug}/installations/new`;
  }

  async owner(workspaceId: WorkspaceId): Promise<string | null> {
    const installation = await this.installations.maybe(workspaceId);

    if (!installation) {
      return null;
    }

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
