import type {
  InstallationPermissionsDto,
  InstallationPermissionsPort,
} from '@github/application/ports/installation-permissions.port';
import type { InstallationsPort } from '@github/application/ports/installations.port';
import type {
  RepositoryAccessPort,
  RepositoryCredential,
} from '@github/application/ports/repository-access.port';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { InstallationPermissions } from '@github/domain/value-objects/installation-permissions.vo';
import { appJwt } from '@github/infrastructure/github/app-jwt';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { z } from 'zod';

const API = 'https://api.github.com';

const RENEW_BEFORE_MS = 60_000;

const PERMISSIONS_FRESH_MS = 30_000;

const PERMISSIONS_TIMEOUT_MS = 5_000;

// A token without workflows is renewed sooner, so a replica that never reads
// the permissions still picks up ones accepted on GitHub.
const NARROW_TOKEN_MS = 5 * 60_000;

type Minted = {
  token: string;
  expiresAt: number;
  mintedAt: number;
  permissions: InstallationPermissions;
};

type Read = { permissions: InstallationPermissions; readAt: number };

const GRANTED = z.record(z.string(), z.unknown());

const MINTED_TOKEN = z.object({
  token: z.string().optional(),
  expires_at: z.string().optional(),
  permissions: GRANTED.optional(),
});

const INSTALLATION = z.object({ permissions: GRANTED.optional() });

@Injectable()
export class GitHubAppAccess
  implements RepositoryAccessPort, InstallationPermissionsPort
{
  readonly #tokenCache = new Map<string, Minted>();

  readonly #permissionsCache = new Map<string, Read>();

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

  async of(
    workspaceId: WorkspaceId,
  ): Promise<InstallationPermissionsDto | null> {
    const installation = await this.installations.maybe(workspaceId);
    const permissions = installation
      ? await this.permissionsOf(installation)
      : null;

    return (
      permissions && {
        workflows: permissions.changesWorkflows(),
        variables: permissions.setsVariables(),
      }
    );
  }

  private async permissionsOf(
    installation: GitHubInstallation,
  ): Promise<InstallationPermissions | null> {
    const read = this.#permissionsCache.get(installation.value);

    if (read && read.readAt + PERMISSIONS_FRESH_MS > Date.now()) {
      return read.permissions;
    }

    const permissions = await this.readPermissions(installation);

    if (!permissions) {
      return null;
    }

    this.#permissionsCache.set(installation.value, {
      permissions,
      readAt: Date.now(),
    });

    // A token keeps the permissions it was minted with. Once someone accepts
    // new ones on GitHub, mint a token that has them.
    const minted = this.#tokenCache.get(installation.value);
    if (minted && permissions.grantsBeyond(minted.permissions)) {
      this.#tokenCache.delete(installation.value);
    }

    return permissions;
  }

  // Null when GitHub would not say: what the App may do only shapes what
  // Spotlight tells people and agents, so it never stops their work.
  private async readPermissions(
    installation: GitHubInstallation,
  ): Promise<InstallationPermissions | null> {
    try {
      const response = await fetch(
        `${API}/app/installations/${installation.value}`,
        {
          headers: this.asTheApp(),
          signal: AbortSignal.timeout(PERMISSIONS_TIMEOUT_MS),
        },
      );

      if (!response.ok) {
        return null;
      }

      const answer = INSTALLATION.safeParse(await response.json());

      return answer.success && answer.data.permissions
        ? InstallationPermissions.of(answer.data.permissions)
        : null;
    } catch {
      return null;
    }
  }

  private asTheApp(): Record<string, string> {
    return {
      authorization: `Bearer ${appJwt(this.env)}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    };
  }

  private async token(installation: GitHubInstallation): Promise<string> {
    const cached = this.#tokenCache.get(installation.value);

    if (cached && this.renewsAt(cached) > Date.now()) {
      return cached.token;
    }

    const minted = await this.mint(installation);
    this.#tokenCache.set(installation.value, minted);

    return minted.token;
  }

  private renewsAt(minted: Minted): number {
    const expiring = minted.expiresAt - RENEW_BEFORE_MS;

    return minted.permissions.changesWorkflows()
      ? expiring
      : Math.min(expiring, minted.mintedAt + NARROW_TOKEN_MS);
  }

  private async mint(installation: GitHubInstallation): Promise<Minted> {
    const response = await fetch(
      `${API}/app/installations/${installation.value}/access_tokens`,
      {
        method: 'POST',
        headers: this.asTheApp(),
      },
    );

    if (!response.ok) {
      throw new UpstreamError(
        'GitHub would not mint an installation token',
        `${response.status}`,
      );
    }

    const answer = MINTED_TOKEN.safeParse(await response.json());
    const token = answer.data?.token;
    const expiresAt = answer.data?.expires_at;

    if (!nonEmpty(token) || !nonEmpty(expiresAt)) {
      throw new UpstreamError(
        'GitHub would not mint an installation token',
        'The answer had no token',
      );
    }

    return {
      token,
      expiresAt: new Date(expiresAt).getTime(),
      mintedAt: Date.now(),
      permissions: InstallationPermissions.of(answer.data?.permissions ?? {}),
    };
  }
}
