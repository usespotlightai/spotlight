import { z } from 'zod';

const MAX_WAIT_MS = 10 * 60 * 1000;

const UNSUPPORTED = new Set(['$schema', 'minimum', 'maximum']);

export type Fetch = typeof globalThis.fetch;

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

const TRUNCATED = 'length';

export interface ModelEndpoint {
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly model: string;
}

export class ModelRequestError extends Error {
  constructor(reason: string) {
    super(`The model request failed. Response: ${reason}`);
    this.name = 'ModelRequestError';
  }
}

export class ModelEmptyCompletionError extends Error {
  constructor(
    readonly reason: string,
    readonly usage: CompletionUsage | null,
  ) {
    super(`The model returned no usable answer. Reason: ${reason}`);
    this.name = 'ModelEmptyCompletionError';
  }

  get truncated(): boolean {
    return this.reason === TRUNCATED;
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
  };
  readonly error?: { readonly message?: string };
}

interface CompletionUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cost: null;
}

export interface StructuredCompletion<T> {
  readonly answer: T;
  readonly usage: CompletionUsage | null;
}

const counted = (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;

const usageOf = (completion: Completion): CompletionUsage | null =>
  completion.usage
    ? {
        inputTokens: counted(completion.usage.prompt_tokens),
        outputTokens: counted(completion.usage.completion_tokens),
        cost: null,
      }
    : null;

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

const completionsUrlOf = (baseUrl: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

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
  endpoint: ModelEndpoint;
  fetch: Fetch;
  responseSchema: JsonSchema<T>;
  system: string;
  prompt: string;
  maxTokens: number;
  reasoning?: ReasoningEffort;
}): Promise<StructuredCompletion<T>> => {
  const { endpoint } = request;

  const response = await request
    .fetch(completionsUrlOf(endpoint.baseUrl), {
      method: 'POST',
      signal: AbortSignal.timeout(MAX_WAIT_MS),
      headers: {
        ...(endpoint.apiKey
          ? { Authorization: `Bearer ${endpoint.apiKey}` }
          : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: endpoint.model,
        max_completion_tokens: request.maxTokens,
        ...(request.reasoning ? { reasoning_effort: request.reasoning } : {}),
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
      }),
    })
    .catch((error: unknown) => {
      throw new ModelRequestError(
        error instanceof Error ? error.message : String(error),
      );
    });

  const completion = (await response.json().catch(() => ({}))) as Completion;

  if (!response.ok) {
    throw new ModelRequestError(
      `${response.status} ${completion.error?.message ?? response.statusText}`,
    );
  }

  const [choice] = completion.choices ?? [];

  if (choice?.finish_reason !== 'stop' || !choice.message?.content) {
    throw new ModelEmptyCompletionError(
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
    throw new ModelEmptyCompletionError(
      `the answer doesn't match the expected shape (${error instanceof Error ? error.message : String(error)})`,
      usageOf(completion),
    );
  }
};
