import { JudgingError } from '@insights/application/errors/judging.error';
import type { SideBySideJudgeRequest } from '@insights/application/ports/side-by-side-judge.port';
import { OpenRouterSideBySideJudge } from '@insights/infrastructure/judging/openrouter-side-by-side-judge';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, line: string) => ({
  id,
  path: 'api/q.ts',
  header: '@@ -1 +1 @@',
  lines: [line],
});

const REQUEST: SideBySideJudgeRequest = {
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

describe('judging two changes side by side through OpenRouter', () => {
  it('keeps the claims in its instructions, sends both changes and the accepted one as one JSON document, and reads which it preferred', async () => {
    const reasons = [{ text: 'A drains fast.', hunks: ['A:api/q.ts#1'] }];
    const { requests, fetch } = answering(
      completed(JSON.stringify({ preferred: 'A', reasons })),
    );

    const answer = await new OpenRouterSideBySideJudge(
      'key',
      'some/model',
      fetch,
    ).judgePair(REQUEST);

    const body = JSON.parse(String(requests[0]?.body));
    const system = body.messages[0].content as string;
    const evidence = JSON.parse(body.messages[1].content as string);
    expect(answer).toEqual({
      verdict: { preferred: 'A', reasons },
      usage: null,
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

  it('does not judge without an API key', async () => {
    await expect(
      new OpenRouterSideBySideJudge(undefined, 'some/model').judgePair(REQUEST),
    ).rejects.toBeInstanceOf(JudgingError);
  });
});
