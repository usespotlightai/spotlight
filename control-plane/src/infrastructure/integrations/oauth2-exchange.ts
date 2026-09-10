import type { ClockPort } from '@application/ports/clock.port';
import { HostGrant } from '@domain/value-objects/host-grant.vo';
import {
  bound,
  type Expression,
  value,
} from '@infrastructure/integrations/expression';
import type { ConnectionIR } from '@infrastructure/integrations/integration.compile';
import type { OAuth2Client } from '@infrastructure/integrations/oauth2-clients';
import type { Egress } from '@infrastructure/outbound/egress';

type Fetch = typeof globalThis.fetch;

/** The token endpoint's answer, as much of it as anyone here reads. */
interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * The two calls that turn an authorization into tokens and keep them fresh: the
 * code for the first tokens, and a refresh token for the next. Both are ordinary
 * OAuth2, so there is nothing host-specific here — a host that speaks OAuth2 is
 * this call with its own endpoint. The token endpoint is a real egress with the
 * client secret in it, so it passes the same allowlist every outbound call does.
 */
export class OAuth2Exchange {
  constructor(
    private readonly egress: Egress,
    private readonly clock: ClockPort,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async exchange(
    oauth2: NonNullable<ConnectionIR['oauth2']>,
    client: OAuth2Client,
    code: string,
    redirectUri: string,
  ): Promise<HostGrant | null> {
    return this.post(oauth2, client, oauth2.identity, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
  }

  async refresh(
    oauth2: NonNullable<ConnectionIR['oauth2']>,
    client: OAuth2Client,
    refreshToken: string,
  ): Promise<HostGrant | null> {
    return this.post(oauth2, client, oauth2.identity, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  private async post(
    oauth2: NonNullable<ConnectionIR['oauth2']>,
    client: OAuth2Client,
    identity: Expression | null,
    grant: Record<string, string>,
  ): Promise<HostGrant | null> {
    this.egress.allow(oauth2.token);

    const form = new URLSearchParams({
      ...grant,
      client_id: client.id,
      client_secret: client.secret,
    });

    const reply = await this.fetch(oauth2.token, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: form.toString(),
    });

    if (!reply.ok) {
      return null;
    }

    const response = (await reply
      .json()
      .catch(() => null)) as TokenResponse | null;

    if (!response?.access_token) {
      return null;
    }

    const expiresAt =
      typeof response.expires_in === 'number'
        ? new Date(this.clock.now().getTime() + response.expires_in * 1000)
        : null;

    const scopes = response.scope
      ? response.scope.split(/[\s,]+/).filter(Boolean)
      : [...oauth2.scopes];

    return HostGrant.of({
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? null,
      expiresAt,
      scopes,
      handle: identity
        ? this.named(value(identity, { response: bound(response) }))
        : null,
    });
  }

  private named(read: unknown): string | null {
    return typeof read === 'string' && read !== '' ? read : null;
  }
}
