import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import type {
  OAuth2Endpoints,
  OAuth2IR,
} from '@integrations/infrastructure/integrations/integration.compile';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import {
  type PolicedFetch,
  policedFetch,
} from '@integrations/infrastructure/outbound/policed-fetch';
import {
  discoverOAuthServerInfo,
  extractWWWAuthenticateParams,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { checkResourceAllowed } from '@modelcontextprotocol/sdk/shared/auth-utils.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

type Fetch = typeof globalThis.fetch;

interface Discovered {
  readonly issuer: string;
  readonly authorize: string;
  readonly token: string;
  readonly registration: string | null;
  readonly resource: string;
  readonly scopes: readonly string[];
}

const KEPT_FOR_MS = 10 * 60_000;

const ANSWERS_WITHIN_MS = 15_000;

const PKCE = 'S256';

const UNAUTHORIZED = 401;

const ASKING = JSON.stringify({
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

export class OAuth2Discovery {
  readonly #found = new Map<
    string,
    { readonly discovered: Discovered; readonly until: number }
  >();
  readonly #fetch: PolicedFetch;

  constructor(
    policy: OutboundPolicy,
    private readonly clock: ClockPort,
    fetch: Fetch = globalThis.fetch,
  ) {
    const policed = policedFetch(fetch, policy);

    this.#fetch = (url, init) =>
      policed(url, {
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
      return cached.discovered;
    }

    const discovered = await this.discover(server).catch(() => null);

    if (discovered) {
      this.#found.set(server, { discovered, until: now + KEPT_FOR_MS });
    }

    return discovered;
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
        body: ASKING,
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
