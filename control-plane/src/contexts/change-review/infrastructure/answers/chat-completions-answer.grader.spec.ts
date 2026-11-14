import { ChatCompletionsAnswerGrader } from '@change-review/infrastructure/answers/chat-completions-answer.grader';
import { FixedInferenceCalls } from '@platform/llm/fixed-inference-calls';
import { describe, expect, it } from 'vitest';

const ENDPOINT = {
  baseUrl: 'https://models.example.com/v1',
  apiKey: 'test-key',
  model: 'some/model',
  supportsReasoningEffort: false,
};

const REQUEST = {
  workspaceId: 'workspace-1',
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

type SentBody = {
  model: string;
  response_format: {
    json_schema: {
      schema: { properties: Record<string, { enum: string[] }> };
    };
  };
  messages: { content: string }[];
};

const sentBody = (requests: RequestInit[]) =>
  JSON.parse(requests[0]?.body as string) as SentBody;

describe('ChatCompletionsAnswerGrader', () => {
  it('is unavailable without a key', async () => {
    const grader = new ChatCompletionsAnswerGrader(
      new FixedInferenceCalls(null),
    );

    expect(await grader.availableTo('workspace-1')).toBe(false);
    await expect(grader.grade(REQUEST)).rejects.toThrow('No model endpoint');
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

    const graded = await new ChatCompletionsAnswerGrader(
      new FixedInferenceCalls(ENDPOINT, fetch),
    ).grade(REQUEST);

    expect(graded).toEqual({
      grade: {
        verdict: 'missed',
        feedback: 'The integration signs it, not the bot.',
      },
      usage: null,
    });

    const body = sentBody(requests);
    expect(body.model).toBe('some/model');
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

  it('says grading is unavailable when the model request fails', async () => {
    const fetch = (async () =>
      new Response('overloaded', {
        status: 503,
      })) as unknown as typeof globalThis.fetch;

    await expect(
      new ChatCompletionsAnswerGrader(
        new FixedInferenceCalls(ENDPOINT, fetch),
      ).grade(REQUEST),
    ).rejects.toMatchObject({ kind: 'upstream-error' });
  });

  it('sends at most 24000 characters of cited hunks', async () => {
    const { requests, fetch } = answering({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({ verdict: 'right', feedback: '' }),
          },
        },
      ],
    });

    await new ChatCompletionsAnswerGrader(
      new FixedInferenceCalls(ENDPOINT, fetch),
    ).grade({
      ...REQUEST,
      cited: Array.from({ length: 5 }, (_, place) => ({
        path: `big${place}.ts`,
        patch: 'x'.repeat(10_000),
      })),
    });

    const prompt = sentBody(requests).messages[1].content;
    expect(prompt).toContain('## big2.ts');
    expect(prompt).not.toContain('## big3.ts');
    expect(prompt.length).toBeLessThan(25_000);
  });
});
