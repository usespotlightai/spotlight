import type {
  RepositoryAccessPort,
  RepositoryCredential,
} from '@application/ports/repository-access.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { ENV } from '@infrastructure/config/config.constants';
import type { Env } from '@infrastructure/config/env.schema';
import { assertionFor } from '@infrastructure/github/app-assertion';
import { Inject, Injectable } from '@nestjs/common';

const API = 'https://api.github.com';

const RENEW_BEFORE_MS = 60_000;

type Minted = { token: string; expiresAt: number };

@Injectable()
export class GitHubAppAccess implements RepositoryAccessPort {
  readonly #held = new Map<string, Minted>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  async credential(
    installation: GitHubInstallation,
  ): Promise<RepositoryCredential> {
    return {
      username: 'x-access-token',
      password: await this.token(installation),
    };
  }

  private async token(installation: GitHubInstallation): Promise<string> {
    const held = this.#held.get(installation.value);

    if (held && held.expiresAt - RENEW_BEFORE_MS > Date.now()) {
      return held.token;
    }

    const minted = await this.mint(installation);
    this.#held.set(installation.value, minted);

    return minted.token;
  }

  private async mint(installation: GitHubInstallation): Promise<Minted> {
    const response = await fetch(
      `${API}/app/installations/${installation.value}/access_tokens`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${assertionFor(this.env)}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      throw new UpstreamRefusedError(
        'GitHub would not mint an installation token',
        `${response.status}`,
      );
    }

    const minted = (await response.json()) as {
      token?: string;
      expires_at?: string;
    };

    if (!minted.token || !minted.expires_at) {
      throw new UpstreamRefusedError(
        'GitHub would not mint an installation token',
        'it answered without one',
      );
    }

    return {
      token: minted.token,
      expiresAt: new Date(minted.expires_at).getTime(),
    };
  }
}
