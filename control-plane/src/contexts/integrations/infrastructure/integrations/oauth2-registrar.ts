import type {
  OAuth2ClientRegistrarPort,
  RegisteredClient,
} from '@integrations/application/ports/oauth2-client-registrar.port';
import { OAuth2ClientId } from '@integrations/domain/value-objects/oauth2-client-id.vo';
import type { OAuth2Endpoint } from '@integrations/domain/value-objects/oauth2-endpoint.vo';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';
import { fieldOf } from '@platform/json/field-of';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

type Fetch = typeof globalThis.fetch;

const ANSWERS_WITHIN_MS = 15_000;

export class OAuth2Registrar implements OAuth2ClientRegistrarPort {
  constructor(
    private readonly policy: OutboundPolicy,
    private readonly logger: LoggerPort,
    private readonly fetch: Fetch = policy.fetch,
  ) {}

  async register(
    endpoint: OAuth2Endpoint,
    redirectUri: OAuth2Endpoint,
  ): Promise<RegisteredClient | null> {
    this.policy.allow(endpoint.value);

    const reply = await this.fetch(endpoint.value, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        client_name: 'Spotlight',
        redirect_uris: [redirectUri.value],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      }),
      signal: AbortSignal.timeout(ANSWERS_WITHIN_MS),
      redirect: 'manual',
    });

    if (!reply.ok || reply.type === 'opaqueredirect') {
      return this.refused(endpoint, { status: reply.status });
    }

    const answered: unknown = await reply.json().catch(() => null);
    const writtenId = fieldOf(answered, 'client_id');
    const clientId =
      typeof writtenId === 'string' ? OAuth2ClientId.parsed(writtenId) : null;

    const json = Boolean(answered);

    if (!json || clientId === null) {
      return this.refused(endpoint, {
        status: reply.status,
        answer: json ? 'no-client-id' : 'not-json',
      });
    }

    const secretExpiresAt = fieldOf(answered, 'client_secret_expires_at');
    const expiresAt =
      typeof secretExpiresAt === 'number' && secretExpiresAt > 0
        ? new Date(secretExpiresAt * 1000)
        : null;
    const clientSecret = fieldOf(answered, 'client_secret');

    return {
      clientId,
      clientSecret:
        typeof clientSecret === 'string' && clientSecret !== ''
          ? clientSecret
          : null,
      secretExpiresAt: expiresAt,
    };
  }

  private refused(
    endpoint: OAuth2Endpoint,
    about: { readonly status: number; readonly answer?: string },
  ): null {
    this.logger.warn(
      { server: new URL(endpoint.value).host, ...about },
      'Could not register an OAuth2 client',
    );
    return null;
  }
}
