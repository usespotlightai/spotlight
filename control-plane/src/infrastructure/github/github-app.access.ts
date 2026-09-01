import { createSign } from 'node:crypto';
import type {
  RepositoryAccessPort,
  RepositoryCredential,
} from '@application/ports/repository-access.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { ENV } from '@infrastructure/config/config.constants';
import type { Env } from '@infrastructure/config/env.schema';
import { Inject, Injectable } from '@nestjs/common';

const API = 'https://api.github.com';

/** GitHub refuses a token minted more than ten minutes ahead of its clock. */
const JWT_LIFETIME_SECONDS = 540;

/** Renewed before it lapses, so a clone never starts on a token about to die. */
const RENEW_BEFORE_MS = 60_000;

const base64url = (value: Buffer | string): string =>
  Buffer.from(value).toString('base64url');

type Minted = { token: string; expiresAt: number };

@Injectable()
export class GitHubAppAccess implements RepositoryAccessPort {
  // Held per installation: one workspace's token opens nothing of another's,
  // so they cannot share a slot.
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
          authorization: `Bearer ${this.assertion()}`,
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

  private assertion(): string {
    const issued = Math.floor(Date.now() / 1000);
    const claims = {
      iat: issued - 60,
      exp: issued + JWT_LIFETIME_SECONDS,
      iss: this.env.GITHUB_APP_ID,
    };

    const signed = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
      JSON.stringify(claims),
    )}`;

    const signature = createSign('RSA-SHA256')
      .update(signed)
      .sign(this.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'));

    return `${signed}.${base64url(signature)}`;
  }
}
