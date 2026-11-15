import type { ClaimsDraftRequest } from '@insights/application/ports/claims-drafter.port';
import { ChatCompletionsClaimsDrafter } from '@insights/infrastructure/judging/chat-completions-claims-drafter';
import { describe, expect, it } from 'vitest';

const ENDPOINT = {
  baseUrl: 'https://models.example.com/v1',
  apiKey: 'test-key',
  model: 'some/model',
  supportsReasoningEffort: false,
};

const REQUEST: ClaimsDraftRequest = {
  claims: ['It retries the upload.', 'It adds a test.'],
  passThreshold: 1,
  maxCandidates: 2,
  cases: [
    {
      direction: 'judge-failed',
      claimResults: [true, false],
      reasons: [
        { claim: 0, text: 'It retries.' },
        { claim: 1, text: 'No test file changed.' },
      ],
      answers: [
        { claim: 1, answer: 'claim-wrong', note: 'The change is a typo fix.' },
      ],
      note: null,
      shouldHaveFailed: null,
    },
  ],
};

const answering = (content: string) => {
  const requests: RequestInit[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    requests.push(init);
    return new Response(
      JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content } }],
      }),
      { status: 200 },
    );
  }) as unknown as typeof globalThis.fetch;

  return { requests, fetch };
};

describe('ChatCompletionsClaimsDrafter', () => {
  it('drafts at most the asked number of claim lists from the disagreed cases', async () => {
    const { requests, fetch } = answering(
      JSON.stringify({
        candidates: [
          { claims: ['It retries the upload.'], why: 'Tests are optional.' },
          {
            claims: [
              'It retries the upload.',
              'It adds a test when it changes code.',
            ],
            why: 'Typo fixes need no test.',
          },
          { claims: ['A third.'], why: 'Too many.' },
        ],
      }),
    );

    const drafted = await new ChatCompletionsClaimsDrafter(
      ENDPOINT,
      fetch,
    ).drafted(REQUEST);

    expect(drafted).toEqual([
      ['It retries the upload.'],
      ['It retries the upload.', 'It adds a test when it changes code.'],
    ]);
    const sent = JSON.parse(requests[0]?.body as string) as {
      model: string;
      messages: { content: string }[];
      response_format: { json_schema: { name: string } };
    };
    expect(sent.model).toBe('some/model');
    expect(sent.response_format.json_schema.name).toBe('claims_drafts');
    expect(sent.messages.map((each) => each.content).join('\n')).toContain(
      'The change is a typo fix.',
    );
  });

  it('drafts nothing without a model', async () => {
    const drafter = new ChatCompletionsClaimsDrafter(null);

    expect(drafter.available).toBe(false);
    expect(await drafter.drafted(REQUEST)).toEqual([]);
  });
});
