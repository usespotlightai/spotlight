import { z } from 'zod';

export interface OAuth2Client {
  readonly id: string;
  readonly secret: string;
}

const clientsSchema = z.record(
  z.string(),
  z.object({ id: z.string().min(1), secret: z.string().min(1) }),
);

export class OAuth2Clients {
  private constructor(
    private readonly bySource: ReadonlyMap<string, OAuth2Client>,
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
        'OAUTH_CLIENTS must map a source to { id, secret }, as in {"slack":{"id":"...","secret":"..."}}',
      );
    }

    return new OAuth2Clients(new Map(Object.entries(read.data)));
  }

  of(source: string): OAuth2Client | null {
    return this.bySource.get(source) ?? null;
  }
}
