import { z } from 'zod';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const MAX_WAIT_MS = 10 * 60 * 1000;

const UNSUPPORTED = new Set(['$schema', 'minimum', 'maximum']);

export type Fetch = typeof globalThis.fetch;

export class OpenRouterRequestError extends Error {
  constructor(reason: string) {
    super(`The OpenRouter request failed. Response: ${reason}`);
    this.name = 'OpenRouterRequestError';
  }
}

export class OpenRouterEmptyCompletionError extends Error {
  constructor(
    reason: string,
    readonly usage: OpenRouterUsage | null,
  ) {
    super(`OpenRouter returned no usable answer. Reason: ${reason}`);
    this.name = 'OpenRouterEmptyCompletionError';
  }
}

interface Completion {
  readonly choices?: readonly {
    readonly finish_reason?: string | null;
    readonly message?: { readonly content?: string | null };
  }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly cost?: number;
  };
  readonly error?: { readonly message?: string };
}

const OPENROUTER_CURRENCY = 'USD';

interface OpenRouterUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cost: {
    readonly amount: number;
    readonly currency: typeof OPENROUTER_CURRENCY;
  } | null;
}

export interface StructuredCompletion<T> {
  readonly answer: T;
  readonly usage: OpenRouterUsage | null;
}

const counted = (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;

const usageOf = (completion: Completion): OpenRouterUsage | null => {
  const usage = completion.usage;

  const cost = usage ? counted(usage.cost) : null;

  return usage
    ? {
        inputTokens: counted(usage.prompt_tokens),
        outputTokens: counted(usage.completion_tokens),
        cost:
          cost === null
            ? null
            : { amount: cost, currency: OPENROUTER_CURRENCY },
      }
    : null;
};

const strictSchema = (schema: unknown): unknown =>
  Array.isArray(schema)
    ? schema.map(strictSchema)
    : schema && typeof schema === 'object'
      ? Object.fromEntries(
          Object.entries(schema)
            .filter(([key]) => !UNSUPPORTED.has(key))
            .map(([key, value]) => [key, strictSchema(value)]),
        )
      : schema;

export class JsonSchema<T> {
  readonly json: unknown;

  constructor(
    readonly name: string,
    readonly schema: z.ZodType<T>,
  ) {
    this.json = strictSchema(z.toJSONSchema(schema));
  }
}

export const requestJson = async <T>(request: {
  apiKey: string;
  model: string;
  fetch: Fetch;
  responseSchema: JsonSchema<T>;
  system: string;
  prompt: string;
  maxTokens: number;
}): Promise<StructuredCompletion<T>> => {
  const response = await request
    .fetch(ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(MAX_WAIT_MS),
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Spotlight',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: request.responseSchema.name,
            strict: true,
            schema: request.responseSchema.json,
          },
        },
        provider: { require_parameters: true },
        usage: { include: true },
      }),
    })
    .catch((error: unknown) => {
      throw new OpenRouterRequestError(
        error instanceof Error ? error.message : String(error),
      );
    });

  const completion = (await response.json().catch(() => ({}))) as Completion;

  if (!response.ok) {
    throw new OpenRouterRequestError(
      `${response.status} ${completion.error?.message ?? response.statusText}`,
    );
  }

  const [choice] = completion.choices ?? [];

  if (choice?.finish_reason !== 'stop' || !choice.message?.content) {
    throw new OpenRouterEmptyCompletionError(
      choice?.finish_reason ?? completion.error?.message ?? 'no answer',
      usageOf(completion),
    );
  }

  const content = choice.message.content;

  try {
    return {
      answer: request.responseSchema.schema.parse(JSON.parse(content)),
      usage: usageOf(completion),
    };
  } catch (error) {
    throw new OpenRouterEmptyCompletionError(
      `the answer doesn't match the expected shape (${error instanceof Error ? error.message : String(error)})`,
      usageOf(completion),
    );
  }
};
