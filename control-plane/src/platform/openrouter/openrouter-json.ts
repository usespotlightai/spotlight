import { z } from 'zod';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const MAX_WAIT_MS = 10 * 60 * 1000;

const UNSUPPORTED = new Set(['$schema', 'minimum', 'maximum']);

export type Fetch = typeof globalThis.fetch;

export class OpenRouterRefusedError extends Error {
  constructor(reason: string) {
    super(`OpenRouter refused the request. Response: ${reason}`);
    this.name = 'OpenRouterRefusedError';
  }
}

export class OpenRouterUnansweredError extends Error {
  constructor(
    reason: string,
    readonly usage: OpenRouterUsage | null,
  ) {
    super(`OpenRouter gave no usable answer. Reason: ${reason}`);
    this.name = 'OpenRouterUnansweredError';
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

export interface Answered<T> {
  readonly answer: T;
  readonly usage: OpenRouterUsage | null;
}

const counted = (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;

const usageOf = (answered: Completion): OpenRouterUsage | null => {
  const usage = answered.usage;

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
  max: number;
}): Promise<Answered<T>> => {
  const response = await ask
    .fetch(ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(MAX_WAIT_MS),
      headers: {
        Authorization: `Bearer ${ask.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Spotlight',
      },
      body: JSON.stringify({
        model: ask.model,
        max_tokens: ask.max,
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
        usage: { include: true },
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
      usageOf(answered),
    );
  }

  const content = choice.message.content;

  try {
    return {
      answer: ask.shape.schema.parse(JSON.parse(content)),
      usage: usageOf(answered),
    };
  } catch (error) {
    throw new OpenRouterUnansweredError(
      `the answer doesn't match the expected shape (${error instanceof Error ? error.message : String(error)})`,
      usageOf(answered),
    );
  }
};
