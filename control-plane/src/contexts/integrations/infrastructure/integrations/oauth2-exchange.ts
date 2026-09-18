import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import {
  bound,
  type Expression,
  value,
} from '@integrations/infrastructure/integrations/expression';
import type { ConnectionIR } from '@integrations/infrastructure/integrations/integration.compile';
import type { OAuth2Client } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { Egress } from '@integrations/infrastructure/outbound/egress';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

type Fetch = typeof globalThis.fetch;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

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
