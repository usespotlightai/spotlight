import { JudgingError } from '@insights/application/errors/judging.error';
import type { SideBySideJudgeRequest } from '@insights/application/ports/side-by-side-judge.port';
import { ChatCompletionsSideBySideJudge } from '@insights/infrastructure/judging/chat-completions-side-by-side-judge';
import { FixedInferenceCalls } from '@platform/llm/fixed-inference-calls';
import { describe, expect, it } from 'vitest';

const ENDPOINT = {
  baseUrl: 'https://models.example.com/v1',
  apiKey: 'test-key',
  model: 'some/model',
  supportsReasoningEffort: false,
};

const hunk = (id: string, line: string) => ({
  id,
  path: 'api/q.ts',
  header: '@@ -1 +1 @@',
  lines: [line],
});

const REQUEST: SideBySideJudgeRequest = {
  workspaceId: 'workspace_1',
  rubric: null,
  claims: ['It drains the queue in order.'],
  title: 'Drain the queue',
  description: 'It stalls on restart.',
  a: { hunks: [hunk('A:api/q.ts#1', '+drainFast()')], hunksLeftOut: 0 },
  b: { hunks: [hunk('B:api/q.ts#1', '+drain()')], hunksLeftOut: 1 },
  reference: {
    hunks: [hunk('reference:api/q.ts#1', '+drainInOrder()')],
    hunksLeftOut: 0,
  },
};

interface SentRequest {
  readonly messages: readonly { readonly content: string }[];
  readonly response_format: { readonly json_schema: { readonly name: string } };
}

interface Evidence {
  readonly a: { readonly hunks: readonly { readonly id: string }[] };
  readonly b: { readonly left_out: number };
  readonly reference: {
    readonly hunks: readonly { readonly lines: string[] }[];
  };
}

const answering = (answer: Response) => {
  const requests: RequestInit[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    requests.push(init);
    return answer;
  }) as unknown as typeof globalThis.fetch;

  return { requests, fetch };
};

const completed = (content: string) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content } }],
    }),
    { status: 200 },
  );

describe('judging two changes side by side through a chat completions endpoint', () => {
  it('keeps the claims in its instructions, sends both changes and the accepted one as one JSON document, and reads which it preferred', async () => {
    const reasons = [{ text: 'A drains fast.', hunks: ['A:api/q.ts#1'] }];
    const { requests, fetch } = answering(
      completed(JSON.stringify({ preferred: 'A', reasons })),
    );

    const answer = await new ChatCompletionsSideBySideJudge(
      new FixedInferenceCalls(ENDPOINT, fetch),
    ).judgePair(REQUEST);

    const body = JSON.parse(requests[0]?.body as string) as SentRequest;
    const system = body.messages[0].content;
    const evidence = JSON.parse(body.messages[1].content) as Evidence;
    expect(answer).toEqual({
      verdict: { preferred: 'A', reasons },
      model: 'some/model',
    });
    expect(body.response_format.json_schema.name).toBe('pair_verdict');
    expect(system).toContain(
      '<claims>\n0. It drains the queue in order.\n</claims>',
    );
    expect(system).toContain('drawn by lot');
    expect(system).not.toContain('<rubric>');
    expect(evidence.a.hunks[0].id).toBe('A:api/q.ts#1');
    expect(evidence.b.left_out).toBe(1);
    expect(evidence.reference.hunks[0].lines).toEqual(['+drainInOrder()']);
  });

  it('says a cut-short answer was unreadable', async () => {
    const { fetch } = answering(
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'length', message: { content: '{' } }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      new ChatCompletionsSideBySideJudge(
        new FixedInferenceCalls(ENDPOINT, fetch),
      ).judgePair(REQUEST),
    ).rejects.toMatchObject({ kind: 'unreadable' });
  });

  it('does not judge without a model endpoint', async () => {
    await expect(
      new ChatCompletionsSideBySideJudge(
        new FixedInferenceCalls(null),
      ).judgePair(REQUEST),
    ).rejects.toBeInstanceOf(JudgingError);
  });
});
