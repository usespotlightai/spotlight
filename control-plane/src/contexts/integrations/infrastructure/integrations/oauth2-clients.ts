import type {
  ConfiguredOAuth2Client,
  ConfiguredOAuth2ClientsPort,
} from '@integrations/application/ports/configured-oauth2-clients.port';
import { z } from 'zod';

const clientsSchema = z.record(
  z.string(),
  z.object({
    id: z.string().min(1),
    secret: z.string().min(1),
    issuer: z.string().url().optional(),
  }),
);

export class OAuth2Clients implements ConfiguredOAuth2ClientsPort {
  private constructor(
    private readonly bySource: ReadonlyMap<string, ConfiguredOAuth2Client>,
  ) {}

  static from(json: string): OAuth2Clients {
    let parsed: unknown;

    try {
      parsed = JSON.parse(json || '{}');
    } catch (error) {
      throw new Error(
        `OAUTH_CLIENTS is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const read = clientsSchema.safeParse(parsed);

    if (!read.success) {
      throw new Error(
        'OAUTH_CLIENTS must map a source to { id, secret }, with the issuer of its authorization server for an MCP server it discovers, as in {"slack":{"id":"...","secret":"..."}}',
      );
    }

    return new OAuth2Clients(
      new Map(
        Object.entries(read.data).map(([source, client]) => [
          source,
          { ...client, issuer: client.issuer ?? null },
        ]),
      ),
    );
  }

  of(source: string): ConfiguredOAuth2Client | null {
    return this.bySource.get(source) ?? null;
  }
}
