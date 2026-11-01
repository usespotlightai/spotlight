import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import type {
  OAuth2Endpoints,
  OAuth2IR,
} from '@integrations/infrastructure/integrations/integration.compile';
import {
  type GuardedFetch,
  guardedFetch,
} from '@integrations/infrastructure/outbound/guarded-fetch';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import {
  discoverOAuthServerInfo,
  extractWWWAuthenticateParams,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { checkResourceAllowed } from '@modelcontextprotocol/sdk/shared/auth-utils.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { OncePer } from '@shared-kernel/application/services/once-per';

type Fetch = typeof globalThis.fetch;

interface Discovered {
  readonly issuer: string;
  readonly authorize: string;
  readonly token: string;
  readonly registration: string | null;
  readonly resource: string;
  readonly scopes: readonly string[];
}

const CACHE_TTL_MS = 10 * 60_000;

const ANSWERS_WITHIN_MS = 15_000;

const PKCE = 'S256';

const UNAUTHORIZED = 401;

const OAUTH_DISCOVERY_REQUEST = JSON.stringify({
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'spotlight', version: '1.0.0' },
  },
});

const withoutTrailingSlash = (url: string): string => url.replace(/\/$/, '');

export const authorizationServerOf = (
  endpoints: OAuth2Endpoints,
): AuthorizationServer | null =>
  endpoints.issuer === null
    ? null
    : AuthorizationServer.of({
        issuer: endpoints.issuer,
        authorize: endpoints.authorize,
        token: endpoints.token,
      });

const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

export class OAuth2Discovery {
  readonly #found = new Map<
    string,
    { readonly discovered: Discovered; readonly until: number }
  >();
  readonly #fetch: GuardedFetch;
  readonly #failed = new OncePer(CACHE_TTL_MS);

  constructor(
    private readonly policy: OutboundPolicy,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    fetch: Fetch = policy.fetch,
  ) {
    const guarded = guardedFetch(fetch, policy);

    this.#fetch = (url, init) =>
      guarded(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(ANSWERS_WITHIN_MS),
      });
  }

  async endpoints(oauth2: OAuth2IR): Promise<OAuth2Endpoints | null> {
    if (oauth2.discoverAt === null) {
      return {
        issuer: null,
        authorize: oauth2.authorize,
        token: oauth2.token,
        scopes: oauth2.scopes,
        identity: oauth2.identity,
        registration: oauth2.registration,
        resource: oauth2.resource,
      };
    }

    const discovered = await this.discovered(oauth2.discoverAt);

    return discovered
      ? {
          issuer: discovered.issuer,
          authorize: discovered.authorize,
          token: discovered.token,
          registration: discovered.registration,
          resource: oauth2.resource ?? discovered.resource,
          scopes: oauth2.scopes.length > 0 ? oauth2.scopes : discovered.scopes,
          identity: oauth2.identity,
        }
      : null;
  }

  private async discovered(server: string): Promise<Discovered | null> {
    const now = this.clock.now().getTime();
    const cached = this.#found.get(server);

    if (cached && cached.until > now) {
      return this.allows(server) ? cached.discovered : null;
    }

    const discovered = await this.discover(server).catch((error: unknown) => {
      const host = hostOf(server);

      if (this.#failed.due(host ?? server, this.clock.now())) {
        this.logger.warn(
          {
            server: host,
            error: error instanceof Error ? error.name : 'unknown',
          },
          'Could not discover the OAuth server of an integration',
        );
      }
      return null;
    });

    if (discovered) {
      this.#found.set(server, { discovered, until: now + CACHE_TTL_MS });
    }

    return discovered;
  }

  private allows(server: string): boolean {
    try {
      this.policy.allow(server);
      return true;
    } catch {
      return false;
    }
  }

  private async discover(server: string): Promise<Discovered | null> {
    const info = await discoverOAuthServerInfo(server, {
      resourceMetadataUrl: await this.pointedAt(server),
      fetchFn: this.#fetch,
    });
    const metadata = info.authorizationServerMetadata;
    const resource = info.resourceMetadata?.resource ?? server;

    if (
      !metadata ||
      withoutTrailingSlash(metadata.issuer) !==
        withoutTrailingSlash(info.authorizationServerUrl) ||
      !metadata.code_challenge_methods_supported?.includes(PKCE) ||
      !checkResourceAllowed({
        requestedResource: server,
        configuredResource: resource,
      })
    ) {
      return null;
    }

    return {
      issuer: metadata.issuer,
      authorize: metadata.authorization_endpoint,
      token: metadata.token_endpoint,
      registration: metadata.registration_endpoint ?? null,
      resource,
      scopes: info.resourceMetadata?.scopes_supported ?? [],
    };
  }

  private async pointedAt(server: string): Promise<URL | undefined> {
    try {
      const reply = await this.#fetch(server, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: OAUTH_DISCOVERY_REQUEST,
      });

      await reply.body?.cancel();

      return reply.status === UNAUTHORIZED
        ? extractWWWAuthenticateParams(reply).resourceMetadataUrl
        : undefined;
    } catch {
      return undefined;
    }
  }
}
