import { z } from 'zod';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const MOST_WAIT_MS = 10 * 60 * 1000;

const UNSUPPORTED = new Set(['$schema', 'minimum', 'maximum']);

export type Fetch = typeof globalThis.fetch;

export class OpenRouterRefusedError extends Error {
  constructor(reason: string) {
    super(`OpenRouter refused to draft: ${reason}`);
    this.name = 'OpenRouterRefusedError';
  }
}

export class OpenRouterUnansweredError extends Error {
  constructor(reason: string) {
    super(`Drafting stopped early: ${reason}`);
    this.name = 'OpenRouterUnansweredError';
  }
}

interface Completion {
  readonly choices?: readonly {
    readonly finish_reason?: string | null;
    readonly message?: { readonly content?: string | null };
  }[];
  readonly error?: { readonly message?: string };
}

const portable = (schema: unknown): unknown =>
  Array.isArray(schema)
    ? schema.map(portable)
    : schema && typeof schema === 'object'
      ? Object.fromEntries(
          Object.entries(schema)
            .filter(([key]) => !UNSUPPORTED.has(key))
            .map(([key, value]) => [key, portable(value)]),
        )
      : schema;

export class JsonShape<T> {
  readonly json: unknown;

  constructor(
    readonly name: string,
    readonly schema: z.ZodType<T>,
  ) {
    this.json = portable(z.toJSONSchema(schema));
  }
}

export const askForJson = async <T>(ask: {
  apiKey: string;
  model: string;
  fetch: Fetch;
  shape: JsonShape<T>;
  system: string;
  asked: string;
  most: number;
}): Promise<T> => {
  const response = await ask
    .fetch(ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(MOST_WAIT_MS),
      headers: {
        Authorization: `Bearer ${ask.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Spotlight',
      },
      body: JSON.stringify({
        model: ask.model,
        max_tokens: ask.most,
        messages: [
          { role: 'system', content: ask.system },
          { role: 'user', content: ask.asked },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: ask.shape.name,
            strict: true,
            schema: ask.shape.json,
          },
        },
        provider: { require_parameters: true },
      }),
    })
    .catch((error: unknown) => {
      throw new OpenRouterRefusedError(
        error instanceof Error ? error.message : String(error),
      );
    });

  const answered = (await response.json().catch(() => ({}))) as Completion;

  if (!response.ok) {
    throw new OpenRouterRefusedError(
      `${response.status} ${answered.error?.message ?? response.statusText}`,
    );
  }

  const [choice] = answered.choices ?? [];

  if (choice?.finish_reason !== 'stop' || !choice.message?.content) {
    throw new OpenRouterUnansweredError(
      choice?.finish_reason ?? answered.error?.message ?? 'no answer',
    );
  }

  const content = choice.message.content;

  try {
    return ask.shape.schema.parse(JSON.parse(content));
  } catch (error) {
    throw new OpenRouterUnansweredError(
      `the answer did not fit its shape (${error instanceof Error ? error.message : String(error)})`,
    );
  }
};
