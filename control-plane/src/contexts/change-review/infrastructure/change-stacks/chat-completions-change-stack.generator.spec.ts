import { factsOf } from '@change-review/domain/services/diff-facts';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { HunkId, LayerId } from '@change-review/domain/value-objects/stack-ids';
import {
  ChatCompletionsChangeStackGenerator,
  describeProblem,
  previousStackPrompt,
  redraftPrompt,
} from '@change-review/infrastructure/change-stacks/chat-completions-change-stack.generator';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { describe, expect, it } from 'vitest';

const ENDPOINT = {
  baseUrl: 'https://models.example.com/v1',
  apiKey: 'test-key',
  model: 'some/model',
  supportsReasoningEffort: true,
};

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
        questions: [
          {
            question: 'What happens when the address is already a member?',
            answer: 'It sends no invitation and answers 409.',
            hunks: ['h1', 'H7 '],
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

const generate = (generator: ChatCompletionsChangeStackGenerator) =>
  generator.generate({
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

describe('ChatCompletionsChangeStackGenerator', () => {
  it('is unavailable without a key', async () => {
    const generator = new ChatCompletionsChangeStackGenerator(null);

    expect(generator.available).toBe(false);
    await expect(generate(generator)).rejects.toThrow('No model endpoint');
  });

  it('requests a stack in the stack’s own shape from the model, from providers that follow it, and leaves its hunk ids as written', async () => {
    const { requests, fetch } = answering(200, {
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify({ cohorts: COHORTS }) },
        },
      ],
    });

    const { cohorts, usage } = await generate(
      new ChatCompletionsChangeStackGenerator(ENDPOINT, fetch),
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
            hunks: [{ hunk: 'h1' }],
            notes: [
              {
                path: 'src/invite.ts',
                note: 'Adds the function that sends an invitation.',
              },
            ],
            questions: [
              {
                question: 'What happens when the address is already a member?',
                answer: 'It sends no invitation and answers 409.',
                hunks: ['h1', 'H7 '],
              },
            ],
          },
        ],
      },
    ]);
    expect(requests[0]?.url).toBe(
      'https://models.example.com/v1/chat/completions',
    );
    expect(
      (requests[0]?.init.headers as Record<string, string> | undefined)
        ?.Authorization,
    ).toBe('Bearer test-key');

    const body = JSON.parse(String(requests[0]?.init.body));
    expect(body.model).toBe('some/model');
    expect(body.max_completion_tokens).toBe(65_536);
    expect(body.reasoning_effort).toBe('medium');
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
    expect(layer.required).toContain('questions');
    expect(layer.properties.questions.items.required).toEqual([
      'question',
      'answer',
      'hunks',
    ]);
    expect(body.messages[0].content).toContain(
      'exactly one entry in "files" for every file its ranges touch',
    );
    expect(body.messages[0].content).toContain(
      'No tool finds the answer: the compiler, the linter and the existing tests cannot answer it.',
    );
    expect(body.messages[1].content).toContain('Repository: web');
    expect(body.messages[1].content).toContain('- leaves h2 out');
  });

  it('leaves a range that names no hunk for the stack to report', async () => {
    const { fetch } = answering(200, {
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              cohorts: [
                {
                  ...COHORTS[0],
                  layers: [
                    { ...COHORTS[0]?.layers[0], ranges: [{ hunk: 'hx' }] },
                  ],
                },
              ],
            }),
          },
        },
      ],
    });

    const { cohorts } = await generate(
      new ChatCompletionsChangeStackGenerator(ENDPOINT, fetch),
    );

    expect(cohorts[0]?.layers[0]?.hunks).toEqual([{ hunk: 'hx' }]);
  });

  it('says why the model request failed', async () => {
    const { fetch } = answering(402, {
      error: { message: 'Insufficient credits' },
    });

    await expect(
      generate(new ChatCompletionsChangeStackGenerator(ENDPOINT, fetch)),
    ).rejects.toThrow(
      'The model request failed. Response: 402 Insufficient credits',
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
      generate(new ChatCompletionsChangeStackGenerator(ENDPOINT, fetch)),
    ).rejects.toThrow();
  });

  it('rejects an answer cut short', async () => {
    const { fetch } = answering(200, {
      choices: [{ finish_reason: 'length', message: { content: '{"coh' } }],
    });

    await expect(
      generate(new ChatCompletionsChangeStackGenerator(ENDPOINT, fetch)),
    ).rejects.toMatchObject({
      name: 'GenerationError',
      message: 'The model returned no usable answer. Reason: length',
      truncated: true,
    });
  });

  it('rejects an answer that does not match the shape as not cut short', async () => {
    const { fetch } = answering(200, {
      choices: [{ finish_reason: 'stop', message: { content: '{}' } }],
    });

    await expect(
      generate(new ChatCompletionsChangeStackGenerator(ENDPOINT, fetch)),
    ).rejects.toMatchObject({ name: 'GenerationError', truncated: false });
  });
});

describe('ChatCompletionsChangeStackGenerator, split in calls', () => {
  const answer = (content: unknown) =>
    answering(200, {
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify(content) },
        },
      ],
    });
  const bodyOf = (requests: { init: RequestInit }[]) =>
    JSON.parse(String(requests[0]?.init.body));

  it('requests only the cohorts and their hunks for an outline', async () => {
    const { requests, fetch } = answer({
      cohorts: [
        {
          kind: 'change',
          title: 'Invitations',
          intent: 'Let admins invite people',
          joinedBecause: null,
          hunks: ['h1'],
        },
      ],
    });

    const { cohorts } = await new ChatCompletionsChangeStackGenerator(
      ENDPOINT,
      fetch,
    ).outline({
      diff: DIFF,
      repository: RepositoryName.of('web'),
      facts: factsOf(DIFF, new PatternCodeReading()),
      problems: [{ code: 'shape', message: 'leaves h2 out' }],
    });

    expect(cohorts[0]?.hunks).toEqual(['h1']);
    const body = bodyOf(requests);
    expect(body.response_format.json_schema.name).toBe('change_stack_outline');
    expect(body.reasoning_effort).toBe('medium');
    expect(body.messages[0].content).toContain(
      'Place every hunk exactly once, in the hunks of one cohort.',
    );
    expect(body.messages[1].content).toContain(
      'A previous set of cohorts for this diff had these problems',
    );
  });

  it('tells the model what each hunk uses, removes, tests and moves', async () => {
    const { requests, fetch } = answer({ cohorts: [] });
    const facts = factsOf(DIFF, new PatternCodeReading());
    const link = (
      kind: 'uses' | 'removes' | 'tests' | 'moves',
      because: string,
    ) => ({
      kind,
      from: HunkId.of('h1'),
      to: HunkId.of('h2'),
      because: [because],
    });

    await new ChatCompletionsChangeStackGenerator(ENDPOINT, fetch).outline({
      diff: DIFF,
      repository: null,
      facts: {
        ...facts,
        links: [
          link('uses', 'Invite'),
          link('removes', 'legacy'),
          link('tests', 'invite.ts'),
          link('moves', 'a → b'),
        ],
      },
      problems: [],
    });

    const prompt = bodyOf(requests).messages[1].content;
    for (const fact of [
      'uses Invite from h2',
      'removes legacy, which h2 stops using',
      'tests invite.ts in h2',
      'moves code from h2',
    ]) {
      expect(prompt).toContain(fact);
    }
  });

  it('requests the layers of one cohort from its own part of the diff', async () => {
    const { requests, fetch } = answer({ layers: COHORTS[0]?.layers });

    const { layers } = await new ChatCompletionsChangeStackGenerator(
      ENDPOINT,
      fetch,
    ).layers({
      part: { diff: DIFF, facts: factsOf(DIFF, new PatternCodeReading()) },
      repository: null,
      cohort: {
        kind: 'change',
        title: 'Invitations',
        intent: 'Let admins invite people.',
        joinedBecause: null,
        hunks: [HunkId.of('h1')],
      },
      problems: [],
    });

    expect(layers[0]?.hunks).toEqual([{ hunk: 'h1' }]);
    expect(layers[0]?.notes[0]?.path).toBe('src/invite.ts');
    const body = bodyOf(requests);
    expect(body.response_format.json_schema.name).toBe('cohort_layers');
    expect(body.messages[0].content).toContain('You order one cohort');
    expect(body.messages[1].content).toContain(
      'The cohort, of kind "change": Invitations. Let admins invite people.',
    );
    expect(body.messages[1].content).toContain(
      "The cohort's diff, as 1 hunks to place:",
    );
  });
});

describe('redraftPrompt', () => {
  it('requests the few changes a failing layer needs to move, with what the check printed and where the named files sit', () => {
    const text = redraftPrompt({
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

describe('previousStackPrompt', () => {
  const FACTS = {
    hunks: [
      {
        hunk: HunkId.of('h1'),
        path: 'src/invite.ts',
        fileClass: 'source' as const,
        incidental: false,
        renamed: false,
        moved: false,
        linkable: true,
        defines: [],
        outside: [],
      },
      {
        hunk: HunkId.of('h2'),
        path: 'package-lock.json',
        fileClass: 'lockfile' as const,
        incidental: true,
        renamed: false,
        moved: false,
        linkable: false,
        defines: [],
        outside: [],
      },
    ],
    links: [],
    imports: [],
  };
  const PREVIOUS = {
    stackId: ChangeStackId.of('stack-1'),
    addedHunks: [HunkId.of('h1'), HunkId.of('h2')],
    pathOfHunk: new Map(),
    diffUnchanged: false,
    cohorts: [
      {
        kind: 'change' as const,
        title: 'Invitations',
        intent: 'Let admins invite people',
        joinedBecause: null,
        layers: [
          {
            id: LayerId.of('c1.l1'),
            title: 'Add invite',
            summary: 'The function',
            dependsOn: [],
            hunks: [HunkId.of('h1')],
            paths: ['src/invite.ts'],
            fullyKept: true,
            notes: [],
            questions: [
              {
                question: 'What happens to a member?',
                answer: 'It answers 409.',
                hunks: [HunkId.of('h1')],
              },
            ],
          },
        ],
      },
      {
        kind: 'incidental' as const,
        title: 'Update lockfiles',
        intent: 'Incidental',
        joinedBecause: null,
        layers: [
          {
            id: LayerId.of('c2.l1'),
            title: 'Update lockfiles',
            summary: 'Lockfiles',
            dependsOn: [],
            hunks: [HunkId.of('h2')],
            paths: ['package-lock.json'],
            fullyKept: true,
            notes: [],
            questions: [],
          },
        ],
      },
    ],
  };

  it('shows the earlier stack, its questions and the changed hunks, without what Spotlight places itself', () => {
    const text = previousStackPrompt(PREVIOUS, FACTS, 'stack') ?? '';

    expect(text).toContain(
      'cohort 1 "Invitations": Let admins invite people\nlayer 1 "Add invite" (h1): The function\n  question: What happens to a member?\n  answer: It answers 409.',
    );
    expect(text).toContain('These hunks are new or changed since then: h1.');
    expect(text).not.toContain('lockfiles');
    expect(text).toContain('word for word');
  });

  it('shows only cohorts and their hunks to the outline', () => {
    expect(previousStackPrompt(PREVIOUS, FACTS, 'cohorts')).toContain(
      'cohort 1 "Invitations" (h1)',
    );
  });

  it('shows nothing when no earlier hunk is still there', () => {
    expect(
      previousStackPrompt(
        { ...PREVIOUS, cohorts: PREVIOUS.cohorts.slice(1) },
        FACTS,
        'stack',
      ),
    ).toBeNull();
  });
});
