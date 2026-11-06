import { JsonSchema, requestJson } from '@platform/llm/chat-completions';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const ANSWER = new JsonSchema('answer', z.object({ ok: z.boolean() }));

const answering = () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(
      JSON.stringify({
        choices: [
          { finish_reason: 'stop', message: { content: '{"ok":true}' } },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 2 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof globalThis.fetch;

  return { requests, fetch };
};

const asking = (
  fetch: typeof globalThis.fetch,
  endpoint: { baseUrl: string; apiKey: string | undefined },
) =>
  requestJson({
    endpoint: { ...endpoint, model: 'local/model' },
    fetch,
    responseSchema: ANSWER,
    system: 'system',
    prompt: 'prompt',
    maxTokens: 100,
  });

describe('requesting JSON from a chat completions endpoint', () => {
  it('posts to the endpoint’s chat completions path', async () => {
    const { requests, fetch } = answering();

    await asking(fetch, {
      baseUrl: 'http://localhost:11434/v1/',
      apiKey: 'test-key',
    });

    expect(requests[0]?.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(new Headers(requests[0]?.init.headers).get('Authorization')).toBe(
      'Bearer test-key',
    );
  });

  it('sends no authorization to an endpoint without an API key', async () => {
    const { requests, fetch } = answering();

    const { answer, usage } = await asking(fetch, {
      baseUrl: 'http://localhost:11434/v1',
      apiKey: undefined,
    });

    expect(answer).toEqual({ ok: true });
    expect(usage).toEqual({ inputTokens: 10, outputTokens: 2, cost: null });
    expect(
      new Headers(requests[0]?.init.headers).get('Authorization'),
    ).toBeNull();
  });
});
