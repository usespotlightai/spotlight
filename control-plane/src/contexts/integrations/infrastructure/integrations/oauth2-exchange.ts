import type { OAuth2Client } from '@integrations/application/ports/oauth2-clients.port';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import type { OAuth2Endpoints } from '@integrations/infrastructure/integrations/integration.compile';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { sanitizedForCel } from '@platform/expressions/cel-variables';
import type { Expression } from '@platform/expressions/expression-engine.port';
import { value } from '@platform/expressions/readings';
import { fieldOf } from '@platform/json/field-of';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

type Fetch = typeof globalThis.fetch;

const ANSWERS_WITHIN_MS = 15_000;

export class OAuth2Exchange {
  constructor(
    private readonly policy: OutboundPolicy,
    private readonly clock: ClockPort,
    private readonly fetch: Fetch = policy.fetch,
  ) {}

  async exchange(
    oauth2: OAuth2Endpoints,
    client: OAuth2Client,
    code: string,
    redirectUri: string,
    verifier: string | null,
  ): Promise<OAuthTokens | null> {
    return this.post(oauth2, client, oauth2.identity, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      ...(verifier === null ? {} : { code_verifier: verifier }),
    });
  }

  async refresh(
    oauth2: OAuth2Endpoints,
    client: OAuth2Client,
    refreshToken: string,
  ): Promise<OAuthTokens | null> {
    return this.post(oauth2, client, oauth2.identity, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  private async post(
    oauth2: OAuth2Endpoints,
    client: OAuth2Client,
    identity: Expression | null,
    grant: Record<string, string>,
  ): Promise<OAuthTokens | null> {
    this.policy.allow(oauth2.token);

    const form = new URLSearchParams({ ...grant, client_id: client.id });

    if (client.secret !== null && client.secret !== '') {
      form.set('client_secret', client.secret);
    }

    if (oauth2.resource !== null && oauth2.resource !== '') {
      form.set('resource', oauth2.resource);
    }

    const reply = await this.fetch(oauth2.token, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(ANSWERS_WITHIN_MS),
      redirect: 'manual',
    });

    if (!reply.ok || reply.type === 'opaqueredirect') {
      return null;
    }

    const response: unknown = await reply.json().catch(() => null);
    const accessToken = fieldOf(response, 'access_token');

    if (typeof accessToken !== 'string' || accessToken === '') {
      return null;
    }

    const expiresIn = fieldOf(response, 'expires_in');
    const expiresAt =
      typeof expiresIn === 'number'
        ? new Date(this.clock.now().getTime() + expiresIn * 1000)
        : null;

    const scope = fieldOf(response, 'scope');
    const scopes =
      typeof scope === 'string' && scope !== ''
        ? scope.split(/[\s,]+/).filter(Boolean)
        : [...oauth2.scopes];

    const refreshToken = fieldOf(response, 'refresh_token');

    return OAuthTokens.of({
      accessToken,
      refreshToken: typeof refreshToken === 'string' ? refreshToken : null,
      expiresAt,
      scopes,
      linkedAccount: identity
        ? this.named(value(identity, { response: sanitizedForCel(response) }))
        : null,
    });
  }

  private named(read: unknown): string | null {
    return typeof read === 'string' && read !== '' ? read : null;
  }
}
