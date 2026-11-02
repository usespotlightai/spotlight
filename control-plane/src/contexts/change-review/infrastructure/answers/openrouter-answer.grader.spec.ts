import { OpenRouterAnswerGrader } from '@change-review/infrastructure/answers/openrouter-answer.grader';
import { describe, expect, it } from 'vitest';

const REQUEST = {
  question: 'Who signs when the member has left?',
  expected: 'The integration signs it.',
  reply: 'The bot.',
  cited: [
    { path: 'slack.ts', patch: '@@ -1 +1 @@\n-bot\n+member ?? integration' },
  ],
};

const answering = (body: unknown) => {
  const requests: RequestInit[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    requests.push(init);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof globalThis.fetch;

  return { requests, fetch };
};

describe('OpenRouterAnswerGrader', () => {
  it('is unavailable without a key', async () => {
    const grader = new OpenRouterAnswerGrader('', 'model');

    expect(grader.available).toBe(false);
    await expect(grader.grade(REQUEST)).rejects.toThrow(
      'No OpenRouter API key',
    );
  });

  it('grades the reply against the expected answer and the cited hunks', async () => {
    const { requests, fetch } = answering({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              verdict: 'missed',
              feedback: 'The integration signs it, not the bot.',
            }),
          },
        },
      ],
    });

    const graded = await new OpenRouterAnswerGrader(
      'or-key',
      'google/gemini-3.8-flash',
      fetch,
    ).grade(REQUEST);

    expect(graded).toEqual({
      grade: {
        verdict: 'missed',
        feedback: 'The integration signs it, not the bot.',
      },
      usage: null,
    });

    const body = JSON.parse(String(requests[0]?.body));
    expect(body.model).toBe('google/gemini-3.8-flash');
    expect(
      body.response_format.json_schema.schema.properties.verdict.enum,
    ).toEqual(['right', 'partly-right', 'missed']);
    expect(body.messages[0].content).toContain('Judge meaning, not wording');
    expect(body.messages[1].content).toContain(
      'Expected answer: The integration signs it.',
    );
    expect(body.messages[1].content).toContain(
      '## slack.ts\n@@ -1 +1 @@\n-bot\n+member ?? integration',
    );
    expect(body.messages[1].content).toContain(
      "The reviewer's answer: The bot.",
    );
  });

  it('says grading is unavailable when OpenRouter fails', async () => {
    const fetch = (async () =>
      new Response('overloaded', {
        status: 503,
      })) as unknown as typeof globalThis.fetch;

    await expect(
      new OpenRouterAnswerGrader('or-key', 'model', fetch).grade(REQUEST),
    ).rejects.toMatchObject({ kind: 'upstream-error' });
  });
});
