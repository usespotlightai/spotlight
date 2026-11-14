import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
import { InferenceTransport } from '@inference/infrastructure/outbound/inference-transport';
import { JsonSchema } from '@platform/llm/chat-completions';
import {
  OutboundBlockedError,
  type OutboundGuard,
} from '@platform/outbound/outbound-guard';
import type { LogFields } from '@shared-kernel/application/ports/logger.port';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const ENDPOINT = {
  baseUrl: 'https://llm.example.com/v1',
  model: 'gpt-5-mini',
  apiKey: 'sk-secret',
  supportsReasoningEffort: false,
};

const SCHEMA = new JsonSchema('answer', z.object({ ok: z.boolean() }));

const REQUEST = {
  responseSchema: SCHEMA,
  system: 'Answer.',
  prompt: 'Go.',
  maxTokens: 10,
};

const answering = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

const stop = (content: string) => ({
  choices: [{ finish_reason: 'stop', message: { content } }],
});

const transportOver = (
  fetch: (url: unknown, init?: unknown) => Promise<Response>,
  refused: OutboundBlockedError | null = null,
) => {
  const counted: Record<string, string>[] = [];
  const warned: LogFields[] = [];
  const guard = {
    fetch,
    check: () => {
      if (refused) {
        throw refused;
      }
    },
  } as unknown as OutboundGuard;
  const scope = {
    within: (_workspace, work) => work(),
  } as WorkspaceOutboundScopePort;
  const transport = new InferenceTransport(
    scope,
    guard,
    {
      count: (_metric, attributes) => void counted.push({ ...attributes }),
      measure: () => {},
      inSpan: (_name, _ids, work) => work(),
    },
    {
      debug: () => {},
      info: () => {},
      warn: (fields) => void warned.push(fields),
      error: () => {},
    },
  );

  return { transport, counted, warned };
};

describe('testing the connection to an inference endpoint', () => {
  it('reports success when the endpoint answers', async () => {
    const { transport } = transportOver(answering(stop('{"ok":true}')));

    expect(await transport.probe('ws_1', ENDPOINT)).toEqual({
      ok: true,
      message: 'The endpoint answered.',
    });
  });

  it('reports success when the one token cut the answer short', async () => {
    const { transport } = transportOver(
      answering({ choices: [{ finish_reason: 'length', message: {} }] }),
    );

    expect((await transport.probe('ws_1', ENDPOINT)).ok).toBe(true);
  });

  it('asks for one token', async () => {
    const fetch = answering(stop('{"ok":true}'));
    const { transport } = transportOver(fetch);

    await transport.probe('ws_1', ENDPOINT);

    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];

    const sent = JSON.parse(init.body as string) as {
      max_completion_tokens: number;
    };

    expect(sent.max_completion_tokens).toBe(1);
  });

  it.each([
    [401, 'refused the API key'],
    [402, 'insufficient credits'],
    [404, 'did not find the model'],
    [500, '500'],
  ])('says what status %i means', async (status, said) => {
    const { transport } = transportOver(
      answering({ error: { message: 'no' } }, status),
    );
    const result = await transport.probe('ws_1', ENDPOINT);

    expect(result.ok).toBe(false);
    expect(result.message).toContain(said);
  });

  it('gives the reason when the host is blocked', async () => {
    const { transport } = transportOver(async () => {
      throw new OutboundBlockedError('10.0.0.1', 'The address is private.');
    });

    expect(await transport.probe('ws_1', ENDPOINT)).toEqual({
      ok: false,
      message: 'The address is private.',
    });
  });

  it('reports a timeout', async () => {
    const { transport } = transportOver(async () => {
      throw new Error('The operation was aborted due to timeout');
    });
    const result = await transport.probe('ws_1', ENDPOINT);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('timeout');
  });

  it('never repeats the key in what it reports', async () => {
    const { transport } = transportOver(
      answering({ error: { message: 'bad key' } }, 401),
    );

    expect(
      JSON.stringify(await transport.probe('ws_1', ENDPOINT)),
    ).not.toContain('sk-secret');
  });
});

describe('calling an inference endpoint', () => {
  it('counts the outcome of each request', async () => {
    const { transport, counted } = transportOver(
      answering({ error: { message: 'pay' } }, 402),
    );

    await expect(
      transport.call('ws_1', ENDPOINT, REQUEST),
    ).rejects.toMatchObject({ insufficientCredits: true });

    expect(counted).toEqual([
      { 'spotlight.inference.outcome': 'insufficient_credits' },
    ]);
  });

  it('counts a blocked host', async () => {
    const { transport, counted } = transportOver(async () => {
      throw new OutboundBlockedError('llm.example.com', 'Not listed.');
    });

    await expect(transport.call('ws_1', ENDPOINT, REQUEST)).rejects.toThrow(
      'request failed',
    );
    expect(counted[0]).toEqual({ 'spotlight.inference.outcome': 'blocked' });
  });

  it('counts success and logs nothing', async () => {
    const { transport, counted, warned } = transportOver(
      answering(stop('{"ok":true}')),
    );

    expect((await transport.call('ws_1', ENDPOINT, REQUEST)).answer).toEqual({
      ok: true,
    });
    expect(counted).toEqual([{ 'spotlight.inference.outcome': 'ok' }]);
    expect(warned).toEqual([]);
  });

  it('logs the workspace, the host and the status, never the key', async () => {
    const { transport, warned } = transportOver(
      answering({ error: { message: 'no' } }, 401),
    );

    await expect(transport.call('ws_1', ENDPOINT, REQUEST)).rejects.toThrow(
      'request failed',
    );

    expect(warned).toEqual([
      {
        workspaceId: 'ws_1',
        host: 'llm.example.com',
        status: 401,
        outcome: 'unauthorized',
      },
    ]);
    expect(JSON.stringify(warned)).not.toContain('sk-secret');
  });
});

describe('checking the base URL against the egress rules', () => {
  it('returns no refusal for an allowed host', async () => {
    const { transport } = transportOver(answering({}));

    expect(await transport.refusalOf('ws_1', ENDPOINT.baseUrl)).toBeNull();
  });

  it('returns the reason for a refused host', async () => {
    const { transport } = transportOver(
      answering({}),
      new OutboundBlockedError('10.0.0.1', 'The address is private.'),
    );

    expect(await transport.refusalOf('ws_1', 'http://10.0.0.1/v1')).toBe(
      'The address is private.',
    );
  });
});
