import type { InstallationsPort } from '@github/application/ports/installations.port';
import type {
  RepositoryAccessPort,
  RepositoryCredential,
} from '@github/application/ports/repository-access.port';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { appJwt } from '@github/infrastructure/github/app-jwt';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const API = 'https://api.github.com';

const RENEW_BEFORE_MS = 60_000;

type Minted = { token: string; expiresAt: number };

@Injectable()
export class GitHubAppAccess implements RepositoryAccessPort {
  readonly #tokenCache = new Map<string, Minted>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly installations: InstallationsPort,
  ) {}

  async credential(workspaceId: WorkspaceId): Promise<RepositoryCredential> {
    return {
      username: 'x-access-token',
      password: await this.token(await this.installations.of(workspaceId)),
    };
  }

  private async token(installation: GitHubInstallation): Promise<string> {
    const cached = this.#tokenCache.get(installation.value);

    if (cached && cached.expiresAt - RENEW_BEFORE_MS > Date.now()) {
      return cached.token;
    }

    const minted = await this.mint(installation);
    this.#tokenCache.set(installation.value, minted);

    return minted.token;
  }

  private async mint(installation: GitHubInstallation): Promise<Minted> {
    const response = await fetch(
      `${API}/app/installations/${installation.value}/access_tokens`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${appJwt(this.env)}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      throw new UpstreamError(
        'GitHub would not mint an installation token',
        `${response.status}`,
      );
    }

    const minted = (await response.json()) as {
      token?: string;
      expires_at?: string;
    };

    if (!minted.token || !minted.expires_at) {
      throw new UpstreamError(
        'GitHub would not mint an installation token',
        'The answer had no token',
      );
    }

    return {
      token: minted.token,
      expiresAt: new Date(minted.expires_at).getTime(),
    };
  }
}
