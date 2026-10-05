import type {
  OAuth2ClientRegistrarPort,
  RegisteredClient,
} from '@integrations/application/ports/oauth2-client-registrar.port';
import type { OutboundPolicy } from '@integrations/infrastructure/outbound/outbound-policy';

type Fetch = typeof globalThis.fetch;

const ANSWERS_WITHIN_MS = 15_000;

interface RegistrationResponse {
  client_id?: unknown;
  client_secret?: unknown;
  client_secret_expires_at?: unknown;
}

export class OAuth2Registrar implements OAuth2ClientRegistrarPort {
  constructor(
    private readonly policy: OutboundPolicy,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async register(
    endpoint: string,
    redirectUri: string,
  ): Promise<RegisteredClient | null> {
    this.policy.allow(endpoint);

    const reply = await this.fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        client_name: 'Spotlight',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      }),
      signal: AbortSignal.timeout(ANSWERS_WITHIN_MS),
      redirect: 'manual',
    });

    if (!reply.ok || reply.type === 'opaqueredirect') {
      return null;
    }

    const answered = (await reply
      .json()
      .catch(() => null)) as RegistrationResponse | null;

    if (typeof answered?.client_id !== 'string' || !answered.client_id) {
      return null;
    }

    const expiresAt =
      typeof answered.client_secret_expires_at === 'number' &&
      answered.client_secret_expires_at > 0
        ? new Date(answered.client_secret_expires_at * 1000)
        : null;

    return {
      clientId: answered.client_id,
      clientSecret:
        typeof answered.client_secret === 'string' && answered.client_secret
          ? answered.client_secret
          : null,
      secretExpiresAt: expiresAt,
    };
  }
}
