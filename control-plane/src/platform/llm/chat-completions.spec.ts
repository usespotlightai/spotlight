import {
  JsonSchema,
  ModelEmptyCompletionError,
  type ModelEndpoint,
  ModelRequestError,
  requestJson,
} from '@platform/llm/chat-completions';
import { type ModelPrices, NO_PRICES } from '@platform/llm/model-prices';
import { ReasoningEffortSupport } from '@platform/llm/reasoning-effort-support';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const ANSWER = new JsonSchema('answer', z.object({ ok: z.boolean() }));

const ENDPOINT: ModelEndpoint = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'test-key',
  model: 'local/model',
};

const completed = (choice: object, status = 200) =>
  new Response(
    JSON.stringify({
      choices: [choice],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    }),
    { status },
  );

const stopped = () =>
  completed({
    finish_reason: 'stop',
    message: { content: '{"ok":true}' },
  });

const answering = (response: Response = stopped()) => {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return response;
  }) as unknown as typeof globalThis.fetch;

  return { requests, fetch };
};

const asking = (
  fetch: typeof globalThis.fetch,
  endpoint: Partial<ModelEndpoint> = {},
  reasoning?: 'medium',
) =>
  requestJson({
    endpoint: { ...ENDPOINT, ...endpoint },
    fetch,
    responseSchema: ANSWER,
    system: 'system',
    prompt: 'prompt',
    maxTokens: 100,
    reasoning,
  });

interface SentRequest {
  readonly model: string;
  readonly max_completion_tokens: number;
  readonly response_format: unknown;
  readonly reasoning_effort?: string;
}

const bodyOf = (requests: { init: RequestInit }[]): SentRequest =>
  JSON.parse(requests[0]?.init.body as string) as SentRequest;

describe('requesting JSON from a chat completions endpoint', () => {
  it('posts to the endpoint’s chat completions path', async () => {
    const { requests, fetch } = answering();

    await asking(fetch, { baseUrl: 'http://localhost:11434/v1/' });

    expect(requests[0]?.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(new Headers(requests[0]?.init.headers).get('Authorization')).toBe(
      'Bearer test-key',
    );
  });

  it('sends only standard Chat Completions fields', async () => {
    const { requests, fetch } = answering();

    await asking(fetch);

    const body = bodyOf(requests);
    expect(Object.keys(body).sort()).toEqual([
      'max_completion_tokens',
      'messages',
      'model',
      'response_format',
    ]);
    expect(body.model).toBe('local/model');
    expect(body.max_completion_tokens).toBe(100);
    expect(body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'answer', strict: true },
    });
  });

  it('sends the reasoning effort the request asks for', async () => {
    const { requests, fetch } = answering();

    await asking(fetch, {}, 'medium');

    expect(bodyOf(requests).reasoning_effort).toBe('medium');
  });

  it('sends no reasoning effort when the request asks for none', async () => {
    const { requests, fetch } = answering();

    await asking(fetch);

    expect(bodyOf(requests)).not.toHaveProperty('reasoning_effort');
  });

  it('sends no authorization to an endpoint without an API key', async () => {
    const { requests, fetch } = answering();

    const { answer, usage } = await asking(fetch, { apiKey: undefined });

    expect(answer).toEqual({ ok: true });
    expect(usage).toEqual({ inputTokens: 10, outputTokens: 2, cost: null });
    expect(
      new Headers(requests[0]?.init.headers).get('Authorization'),
    ).toBeNull();
  });

  it('says why the endpoint refused the request', async () => {
    const { fetch } = answering(
      new Response(
        JSON.stringify({ error: { message: 'Unsupported parameter' } }),
        { status: 400 },
      ),
    );

    const failure = asking(fetch);

    await expect(failure).rejects.toBeInstanceOf(ModelRequestError);
    await expect(failure).rejects.toThrow(
      'The model request failed. Response: 400 Unsupported parameter',
    );
  });

  it('hands back the tokens of an answer cut short at the limit', async () => {
    const { fetch } = answering(
      completed({ finish_reason: 'length', message: { content: '{' } }),
    );

    await expect(asking(fetch)).rejects.toMatchObject({
      name: 'ModelEmptyCompletionError',
      truncated: true,
      usage: { inputTokens: 10, outputTokens: 2, cost: null },
    });
  });

  it('refuses an answer in the wrong shape', async () => {
    const { fetch } = answering(
      completed({ finish_reason: 'stop', message: { content: '{"ok":1}' } }),
    );

    await expect(asking(fetch)).rejects.toBeInstanceOf(
      ModelEmptyCompletionError,
    );
  });
});

describe('the cost of a chat completion', () => {
  const usageOf = (usage: object, headers: Record<string, string> = {}) =>
    new Response(
      JSON.stringify({
        choices: [
          { finish_reason: 'stop', message: { content: '{"ok":true}' } },
        ],
        usage,
      }),
      { status: 200, headers },
    );

  const PRICED: ModelPrices = {
    priceOf: (baseUrl, model) =>
      baseUrl === ENDPOINT.baseUrl && model === ENDPOINT.model
        ? { input: 1, output: 10, cachedInput: 0.1, above: [] }
        : null,
    refresh: async () => undefined,
  };

  it('takes the cost the endpoint reports in the usage', async () => {
    const { fetch } = answering(
      usageOf({ prompt_tokens: 10, completion_tokens: 2, cost: 0.004 }),
    );

    const { usage } = await asking(fetch, { prices: PRICED });

    expect(usage?.cost).toEqual({ amount: 0.004, currency: 'USD' });
  });

  it('takes the cost a LiteLLM proxy reports in a header', async () => {
    const { fetch } = answering(
      usageOf(
        { prompt_tokens: 10, completion_tokens: 2 },
        { 'x-litellm-response-cost': '0.0021' },
      ),
    );

    const { usage } = await asking(fetch);

    expect(usage?.cost).toEqual({ amount: 0.0021, currency: 'USD' });
  });

  it('prices the tokens, cached input at its own rate, when the endpoint reports no cost', async () => {
    const { fetch } = answering(
      usageOf({
        prompt_tokens: 1_000_000,
        completion_tokens: 100_000,
        prompt_tokens_details: { cached_tokens: 500_000 },
      }),
    );

    const { usage } = await asking(fetch, { prices: PRICED });

    expect(usage?.cost?.amount).toBeCloseTo(0.5 + 0.05 + 1);
  });

  it('leaves a call unpriced when nothing knows its price', async () => {
    const { fetch } = answering(
      usageOf({ prompt_tokens: 10, completion_tokens: 2 }),
    );

    const { usage } = await asking(fetch, { prices: NO_PRICES });

    expect(usage?.cost).toBeNull();
  });
});

describe('finding out whether a model accepts a reasoning effort', () => {
  const replying = (...responses: Response[]) => {
    const efforts: (string | undefined)[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      efforts.push(
        (JSON.parse(init.body as string) as SentRequest).reasoning_effort,
      );

      return responses.shift() ?? stopped();
    }) as unknown as typeof globalThis.fetch;

    return { efforts, fetch };
  };

  const refused = (status = 400) =>
    new Response(
      JSON.stringify({
        error: { message: 'Unsupported parameter: reasoning_effort' },
      }),
      { status },
    );

  const SUBJECT = { owner: 'ws_1/inference_1', revision: '3' };

  const asked = (
    fetch: typeof globalThis.fetch,
    support: ReasoningEffortSupport,
  ) =>
    requestJson({
      endpoint: ENDPOINT,
      fetch,
      responseSchema: ANSWER,
      system: 'system',
      prompt: 'prompt',
      maxTokens: 100,
      reasoning: 'medium',
      reasoningEffort: { support, subject: SUBJECT },
    });

  it.each([400, 422])(
    'retries once without it when the endpoint refuses it (%i)',
    async (status) => {
      const support = new ReasoningEffortSupport();
      const { efforts, fetch } = replying(refused(status));

      expect((await asked(fetch, support)).answer).toEqual({ ok: true });
      expect(efforts).toEqual(['medium', undefined]);
      expect(support.of(SUBJECT)).toBe(false);
    },
  );

  it('sends none to a model it knows refuses it', async () => {
    const support = new ReasoningEffortSupport();
    support.remember(SUBJECT, false);
    const { efforts, fetch } = replying();

    await asked(fetch, support);

    expect(efforts).toEqual([undefined]);
  });

  it('remembers a model that answered with it', async () => {
    const support = new ReasoningEffortSupport();
    const { fetch } = replying(
      completed({ finish_reason: 'length', message: {} }),
    );

    await expect(asked(fetch, support)).rejects.toBeInstanceOf(
      ModelEmptyCompletionError,
    );

    expect(support.of(SUBJECT)).toBe(true);
  });

  it('does not retry a refusal from a model it knows accepts it', async () => {
    const support = new ReasoningEffortSupport();
    support.remember(SUBJECT, true);
    const { efforts, fetch } = replying(refused());

    await expect(asked(fetch, support)).rejects.toMatchObject({
      status: 400,
    });

    expect(efforts).toEqual(['medium']);
  });

  it('remembers nothing when the retry fails too', async () => {
    const support = new ReasoningEffortSupport();
    const { efforts, fetch } = replying(refused(), refused());

    await expect(asked(fetch, support)).rejects.toMatchObject({
      status: 400,
    });

    expect(efforts).toEqual(['medium', undefined]);
    expect(support.of(SUBJECT)).toBeNull();
  });

  it('does not retry a failure that is not about a parameter', async () => {
    const support = new ReasoningEffortSupport();
    const { efforts, fetch } = replying(
      new Response(JSON.stringify({ error: { message: 'no' } }), {
        status: 401,
      }),
    );

    await expect(asked(fetch, support)).rejects.toMatchObject({
      status: 401,
    });

    expect(efforts).toEqual(['medium']);
    expect(support.of(SUBJECT)).toBeNull();
  });

  it('remembers nothing without a memory', async () => {
    const { efforts, fetch } = replying(refused(), stopped(), refused());
    const once = () =>
      requestJson({
        endpoint: ENDPOINT,
        fetch,
        responseSchema: ANSWER,
        system: 'system',
        prompt: 'prompt',
        maxTokens: 100,
        reasoning: 'medium',
      });

    await once();
    await once();

    expect(efforts).toEqual(['medium', undefined, 'medium', undefined]);
  });
});
