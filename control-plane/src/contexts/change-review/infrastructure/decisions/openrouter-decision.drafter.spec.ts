import { OpenRouterDecisionDrafter } from '@change-review/infrastructure/decisions/openrouter-decision.drafter';
import { describe, expect, it } from 'vitest';

const DECISIONS = [
  {
    kind: 'limitation',
    title: 'Retries only once',
    why: 'A second retry needs backoff the client does not have yet.',
    alternatives: [],
    paths: ['api/src/uploads.ts'],
    steps: [7],
  },
];

const answering = (status: number, body: unknown) => {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof globalThis.fetch;

  return { requests, fetch };
};

const REASONED = {
  steps: [
    { index: 3, kind: 'thought', text: 'Backoff is not in the client yet.' },
    { index: 7, kind: 'message', text: 'Retrying once for now.' },
  ],
  changed: ['api/src/uploads.ts'],
};

describe('drafting decisions through OpenRouter', () => {
  it('requests a draft with the run’s numbered reasoning and the files it changed', async () => {
    const { requests, fetch } = answering(200, {
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify({ decisions: DECISIONS }) },
        },
      ],
    });

    const drafted = await new OpenRouterDecisionDrafter(
      'key',
      'some/model',
      fetch,
    ).draft(REASONED);

    const body = JSON.parse(String(requests[0]?.init.body));
    const prompt = body.messages[1].content as string;

    expect(drafted).toEqual(DECISIONS);
    expect(body.model).toBe('some/model');
    expect(body.response_format.json_schema.name).toBe('decisions');
    expect(prompt).toContain('- api/src/uploads.ts');
    expect(prompt).toContain('[3] thought: Backoff is not in the client yet.');
    expect(prompt).toContain('[7] message: Retrying once for now.');
  });

  it('does not draft without a key', async () => {
    const drafter = new OpenRouterDecisionDrafter(undefined, 'some/model');

    expect(drafter.available).toBe(false);
    await expect(drafter.draft(REASONED)).rejects.toThrow('No OpenRouter');
  });

  it('rejects a draft the model stopped early', async () => {
    const { fetch } = answering(200, {
      choices: [{ finish_reason: 'length', message: { content: '{' } }],
    });

    await expect(
      new OpenRouterDecisionDrafter('key', 'some/model', fetch).draft(REASONED),
    ).rejects.toThrow('OpenRouter returned no usable answer. Reason: length');
  });
});
