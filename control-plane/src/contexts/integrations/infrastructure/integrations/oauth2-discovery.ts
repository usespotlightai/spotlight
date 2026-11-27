import { EgressBlockedError } from '@integrations/application/errors/egress-blocked.error';
import type { OwnOAuth2Client } from '@integrations/application/ports/oauth2-clients.port';
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
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

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

export const ownClientOf = (
  endpoints: OAuth2Endpoints,
): OwnOAuth2Client | null =>
  endpoints.client
    ? {
        id: endpoints.client.id,
        secret:
          endpoints.client.secret !== null && endpoints.client.secret !== ''
            ? SecretName.of(endpoints.client.secret)
            : null,
        token: endpoints.token,
      }
    : null;

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
        client: oauth2.client,
        scopeSeparator: oauth2.scopeSeparator,
        pkce: oauth2.pkce,
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
          client: null,
          scopeSeparator: ' ',
          pkce: true,
        }
      : null;
  }

  private async discovered(server: string): Promise<Discovered | null> {
    try {
      this.policy.allow(server);

      const found = await this.foundOrDiscovered(server);

      if (found) {
        this.allowCallsTo(found);
      }

      return found;
    } catch (error) {
      if (error instanceof EgressBlockedError) {
        this.warnOnce(server, error);
      }

      throw error;
    }
  }

  private async foundOrDiscovered(server: string): Promise<Discovered | null> {
    const now = this.clock.now().getTime();
    const cached = this.#found.get(server);

    if (cached && cached.until > now) {
      return cached.discovered;
    }

    const discovered = await this.discover(server).catch((error: unknown) => {
      if (error instanceof EgressBlockedError) {
        throw error;
      }

      this.warnOnce(server, error);
      return null;
    });

    if (discovered) {
      this.#found.set(server, { discovered, until: now + CACHE_TTL_MS });
    }

    return discovered;
  }

  private allowCallsTo(discovered: Discovered): void {
    this.policy.allow(discovered.issuer);
    this.policy.allow(discovered.token);

    if (discovered.registration !== null && discovered.registration !== '') {
      this.policy.allow(discovered.registration);
    }
  }

  private warnOnce(server: string, error: unknown): void {
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
      metadata.code_challenge_methods_supported?.includes(PKCE) !== true ||
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
