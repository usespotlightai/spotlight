import { factsOf } from '@change-review/domain/services/diff-facts';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import {
  DEFAULT_MODEL,
  describeProblem,
  OpenRouterChangeStackDrafter,
  revised,
} from '@change-review/infrastructure/change-stacks/openrouter-change-stack.drafter';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { describe, expect, it } from 'vitest';

const { diff: DIFF } = new GitDiffReader().read(
  [
    'diff --git a/src/invite.ts b/src/invite.ts',
    '--- a/src/invite.ts',
    '+++ b/src/invite.ts',
    '@@ -1 +1 @@',
    '-before',
    '+export function invite() {}',
  ].join('\n'),
);

const COHORTS = [
  {
    kind: 'change',
    title: 'Invitations',
    intent: 'Let admins invite people',
    joinedBecause: null,
    layers: [
      {
        title: 'Add invite',
        summary: 'The function',
        dependsOn: [],
        ranges: [{ hunk: 'h1' }],
        files: [
          {
            path: 'src/invite.ts',
            note: 'Adds the function that sends an invitation.',
          },
        ],
      },
    ],
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

const draft = (drafter: OpenRouterChangeStackDrafter) =>
  drafter.draft({
    diff: DIFF,
    repository: RepositoryName.of('web'),
    facts: factsOf(DIFF, new PatternCodeReading()),
    problems: [{ code: 'shape', message: 'leaves h2 out' }],
  });

describe('describeProblem', () => {
  it('tells the model how to mend a problem it can mend by itself', () => {
    expect(describeProblem({ code: 'shape', message: 'leaves h2 out' })).toBe(
      'leaves h2 out',
    );
    expect(
      describeProblem({
        code: 'unconnected',
        message: 'cohort 1 joins changes the code does not connect (h1 | h2)',
      }),
    ).toBe(
      'cohort 1 joins changes the code does not connect (h1 | h2); split it, or set joinedBecause',
    );
  });
});

describe('OpenRouterChangeStackDrafter', () => {
  it('is unavailable without a key', async () => {
    const drafter = new OpenRouterChangeStackDrafter('');

    expect(drafter.available).toBe(false);
    await expect(draft(drafter)).rejects.toThrow('No OpenRouter API key');
  });

  it('requests a stack in the stack’s own shape from the model, from providers that follow it', async () => {
    const { requests, fetch } = answering(200, {
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify({ cohorts: COHORTS }) },
        },
      ],
    });

    const { cohorts, usage } = await draft(
      new OpenRouterChangeStackDrafter('or-key', DEFAULT_MODEL, fetch),
    );

    expect(usage).toBeNull();

    expect(cohorts).toEqual([
      {
        ...COHORTS[0],
        layers: [
          {
            title: 'Add invite',
            summary: 'The function',
            dependsOn: [],
            ranges: [{ hunk: 'h1' }],
            notes: [
              {
                path: 'src/invite.ts',
                note: 'Adds the function that sends an invitation.',
              },
            ],
          },
        ],
      },
    ]);
    expect(requests[0]?.url).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    );
    expect(
      (requests[0]?.init.headers as Record<string, string> | undefined)
        ?.Authorization,
    ).toBe('Bearer or-key');

    const body = JSON.parse(String(requests[0]?.init.body));
    expect(body.model).toBe('google/gemini-3.8-flash');
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(JSON.stringify(body.response_format.json_schema.schema)).not.toMatch(
      /minimum|maximum|\$schema/,
    );
    const layer =
      body.response_format.json_schema.schema.properties.cohorts.items
        .properties.layers.items;
    expect(layer.required).toContain('files');
    expect(layer.properties.ranges.items.required).toEqual(['hunk']);
    expect(layer.properties.files.items.properties.note).toEqual({
      type: 'string',
    });
    expect(layer.properties.files.items.required).toEqual(['path', 'note']);
    expect(body.messages[0].content).toContain(
      'exactly one entry in "files" for every file its ranges touch',
    );
    expect(body.messages[1].content).toContain('Repository: web');
    expect(body.messages[1].content).toContain('- leaves h2 out');
  });

  it('says why the OpenRouter request failed', async () => {
    const { fetch } = answering(402, {
      error: { message: 'Insufficient credits' },
    });

    await expect(
      draft(new OpenRouterChangeStackDrafter('or-key', DEFAULT_MODEL, fetch)),
    ).rejects.toThrow(
      'The OpenRouter request failed. Response: 402 Insufficient credits',
    );
  });

  it('rejects an answer whose layers leave out their file notes', async () => {
    const { fetch } = answering(200, {
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              cohorts: [
                {
                  ...COHORTS[0],
                  layers: [{ ...COHORTS[0]?.layers[0], files: undefined }],
                },
              ],
            }),
          },
        },
      ],
    });

    await expect(
      draft(new OpenRouterChangeStackDrafter('or-key', DEFAULT_MODEL, fetch)),
    ).rejects.toThrow();
  });

  it('rejects an answer cut short', async () => {
    const { fetch } = answering(200, {
      choices: [{ finish_reason: 'length', message: { content: '{"coh' } }],
    });

    await expect(
      draft(new OpenRouterChangeStackDrafter('or-key', DEFAULT_MODEL, fetch)),
    ).rejects.toThrow('OpenRouter returned no usable answer. Reason: length');
  });
});

describe('revised', () => {
  it('requests the few changes a failing layer needs to move, with what the check printed and where the named files sit', () => {
    const text = revised({
      command: 'npx tsc --noEmit',
      stack: [
        {
          title: 'Labels',
          layers: [
            { title: 'Task reads', hunks: [HunkId.of('h1')] },
            { title: 'HTTP', hunks: [HunkId.of('h2')] },
          ],
        },
      ],
      failed: [
        {
          cohort: 0,
          layer: 0,
          title: 'Task reads',
          output: 'mapper.spec.ts(5,7): error TS2741',
          named: [
            {
              path: 'src/mapper.spec.ts',
              hunks: [{ hunk: HunkId.of('h2'), layer: 1 }],
            },
          ],
        },
      ],
    });

    expect(text).toContain('`npx tsc --noEmit`');
    expect(text).toContain('moving the few changes it needs');
    expect(text).toContain('a note on each file its ranges touch');
    expect(text).toContain(
      'cohort 1 "Labels": layer 1 "Task reads" (h1); layer 2 "HTTP" (h2)',
    );
    expect(text).toContain('cohort 1, layer 1 "Task reads" does not build');
    expect(text).toContain('src/mapper.spec.ts: h2 in layer 2');
  });
});
