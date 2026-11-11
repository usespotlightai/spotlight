import {
  JsonSchema,
  ModelEmptyCompletionError,
  type ModelEndpoint,
  ModelRequestError,
  requestJson,
} from '@platform/llm/chat-completions';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const ANSWER = new JsonSchema('answer', z.object({ ok: z.boolean() }));

const ENDPOINT: ModelEndpoint = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'test-key',
  model: 'local/model',
  supportsReasoningEffort: false,
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

    await asking(fetch, {}, 'medium');

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

  it('sends the reasoning effort to an endpoint that supports it', async () => {
    const { requests, fetch } = answering();

    await asking(fetch, { supportsReasoningEffort: true }, 'medium');

    expect(bodyOf(requests).reasoning_effort).toBe('medium');
  });

  it('sends no reasoning effort when the request asks for none', async () => {
    const { requests, fetch } = answering();

    await asking(fetch, { supportsReasoningEffort: true });

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
