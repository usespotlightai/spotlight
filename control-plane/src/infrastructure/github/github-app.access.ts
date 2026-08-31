import { createSign } from 'node:crypto';
import { UpstreamRefusedError } from '@application/errors/upstream-refused.error';
import type {
  RepositoryAccessPort,
  RepositoryCredential,
} from '@application/ports/repository-access.port';
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
  #held: Minted | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  async credential(): Promise<RepositoryCredential> {
    return { username: 'x-access-token', password: await this.token() };
  }

  private async token(): Promise<string> {
    const held = this.#held;

    if (held && held.expiresAt - RENEW_BEFORE_MS > Date.now()) {
      return held.token;
    }

    const minted = await this.mint();
    this.#held = minted;

    return minted.token;
  }

  private async mint(): Promise<Minted> {
    const response = await fetch(
      `${API}/app/installations/${this.env.GITHUB_APP_INSTALLATION_ID}/access_tokens`,
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
