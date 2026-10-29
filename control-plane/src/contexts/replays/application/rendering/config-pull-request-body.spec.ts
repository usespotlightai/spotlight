import type { TaskRow } from '@replays/application/dto/task-rows.dto';
import { ConfigPullRequestBody } from '@replays/application/rendering/config-pull-request-body';
import { describe, expect, it } from 'vitest';

const row = (title: string | null, over: Partial<TaskRow> = {}): TaskRow => ({
  taskId: `task_${title}`,
  originalRunId: `run_${title}`,
  title,
  regressed: false,
  live: { result: 'succeeded', successRate: 1, reason: 'Checks passed.' },
  candidate: {
    result: 'succeeded',
    successRate: 1,
    reason: 'Judge passed it: The queue drains in order.',
  },
  ...over,
});

const FACTS = {
  stationKey: 'build',
  lineKey: 'delivery',
  candidateName: 'in-order',
  hypothesis: 'Ask @octocat to merge.\n```\n## Injected\n```',
  unchecked: ['effort'],
  changes: [
    {
      part: 'prompt',
      name: null,
      kind: 'changed' as const,
      was: 'Build it.',
      now: 'Build it, then drain the queue.\nKeep the order.',
    },
    {
      part: 'effort',
      name: null,
      kind: 'changed' as const,
      was: 'low',
      now: 'high',
    },
  ],
  candidate: {
    searchScore: 0.8,
    searchInterval: { low: 0.6, high: 0.95 },
    heldOutScore: 0.5,
    heldOutInterval: null,
    costPerRun: 0.12,
  },
  seed: {
    searchScore: 0.6,
    searchInterval: null,
    heldOutScore: null,
    heldOutInterval: null,
    costPerRun: 0.2,
  },
  currency: 'USD',
  searchedTasks: 7,
  heldOutTasks: 3,
  regressions: { searched: 1, heldOut: 0, total: 1 } as {
    searched: number | null;
    heldOut: number | null;
    total: number | null;
  },
  maxRegressions: null as number | null,
  exceedsRegressionLimit: false,
  gains: {
    searched: {
      gain: 0.2,
      low: -0.02,
      high: 0.41,
      significance: 'within-noise' as const,
      minGain: 0.05,
      tasks: 7,
    },
    heldOut: null,
  },
  pairs: {
    searched: null as { wins: number; losses: number; ties: number } | null,
    heldOut: null as { wins: number; losses: number; ties: number } | null,
  },
  overfit: null,
  heldOutPending: false,
  tasks: {
    heldOut: [
      row('Drain on restart'),
      row('Keep | the order', {
        regressed: true,
        candidate: {
          result: 'failed',
          successRate: 0,
          reason: 'Checks failed: npm test.',
        },
      }),
    ],
    searched: [row(null)],
  },
  search: {
    trigger: 'alert' as const,
    iterations: 3,
    reflections: 1,
    maxIterations: 3,
    perIteration: 2,
    spent: 1.5,
    ceiling: 5,
    agent: { harness: 'claude-code', model: 'opus', effort: null },
    setRuns: 12,
    refreshedAt: new Date('2026-10-27T08:00:00.000Z'),
    spread: 0.06,
    minGain: 0.05,
  },
  found: [
    '“Drain on restart”: the cause is the judge. Please fix the rubric of the judge.',
  ],
};

describe('ConfigPullRequestBody', () => {
  it('fences the agent’s hypothesis in a fence longer than any backtick run in it', () => {
    const body = ConfigPullRequestBody.of(FACTS);

    expect(body).toContain(
      '````text\nAsk @octocat to merge.\n```\n## Injected\n```\n````',
    );
    expect(body).toContain(
      '| Succeeded on the 7 searched tasks | 80% (60–95%) | 60% |',
    );
    expect(body).toContain('`effort`');
    expect(body).not.toContain('Spotlight](');
    expect(body).not.toMatch(/https?:\/\//);
  });

  it('says when the gain over the live config is within noise, and when it is real', () => {
    expect(ConfigPullRequestBody.of(FACTS)).toContain(
      'On the searched tasks the difference, +20 points (−2 to +41), is within noise: it is not clearly more than the 5-point gain the line counts as real.',
    );
    expect(
      ConfigPullRequestBody.of({
        ...FACTS,
        gains: {
          searched: null,
          heldOut: {
            ...FACTS.gains.searched,
            low: 0.1,
            significance: 'better',
          },
        },
      }),
    ).toContain(
      'On the held-out tasks it gained +20 points (+10 to +41) on the live config, more than the 5-point gain the line counts as real.',
    );
  });

  it('warns when the picked candidate gained only on the tasks the search could see, and only then', () => {
    const marked = ConfigPullRequestBody.of({
      ...FACTS,
      gains: {
        searched: { ...FACTS.gains.searched, low: 0.1, significance: 'better' },
        heldOut: {
          gain: -0.03,
          low: -0.2,
          high: 0.12,
          significance: 'within-noise',
          minGain: 0.05,
          tasks: 6,
        },
      },
      overfit: 'likely',
    });

    expect(marked).toContain(
      'Its gain showed only on the tasks the search could see: +20 points on the searched tasks, but −3 points on the held-out tasks the search never showed its agent.',
    );
    expect(ConfigPullRequestBody.of(FACTS)).not.toContain(
      'Its gain showed only on the tasks the search could see',
    );
  });

  it('says when too few held-out tasks were scored to tell whether the gain carries over', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      gains: {
        searched: { ...FACTS.gains.searched, low: 0.1, significance: 'better' },
        heldOut: {
          gain: 0,
          low: -0.5,
          high: 0.5,
          significance: 'within-noise',
          minGain: 0.05,
          tasks: 3,
        },
      },
      overfit: 'too-few-held-out',
    });

    expect(body).toContain(
      'It gained +20 points on the searched tasks, but only 3 held-out tasks scored on both sides, too few to tell whether the gain also shows on tasks the search never showed its agent.',
    );
    expect(body).not.toContain(
      'Its gain showed only on the tasks the search could see',
    );
  });

  it('says the held-out result was still pending when the pull request opened, so the warning could not be checked', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      candidate: { ...FACTS.candidate, heldOutScore: null },
      regressions: { searched: 1, heldOut: null, total: 1 },
      gains: {
        searched: { ...FACTS.gains.searched, low: 0.1, significance: 'better' },
        heldOut: null,
      },
      heldOutPending: true,
    });

    expect(body).toContain(
      'Its held-out replay had not finished when this pull request opened, so Spotlight could not yet check whether its gain also shows on the held-out tasks the search never showed its agent.',
    );
    expect(ConfigPullRequestBody.of(FACTS)).not.toContain(
      'Its held-out replay had not finished',
    );
  });

  it('defuses a mention outside the fence', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      candidateName: '@team',
      hypothesis: null,
    });

    expect(body).not.toMatch(/(^|[^​])@team(?!​)/);
    expect(body).toContain('@​team');
  });

  it('says how the change fared side by side against the live config’s, where it was compared so', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      pairs: { searched: { wins: 4, losses: 1, ties: 2 }, heldOut: null },
    });

    expect(body).toContain(
      "Set side by side with the live config's change on the searched tasks, without the judge knowing which was which, its change was better on 4 tasks, worse on 1 task and as good on 2 tasks.",
    );
    expect(body).not.toContain('on the held-out tasks, without the judge');
    expect(ConfigPullRequestBody.of(FACTS)).not.toContain('side by side');
  });

  it('warns when the candidate regressed on more tasks than the line’s regression limit, and only then', () => {
    const over = ConfigPullRequestBody.of({
      ...FACTS,
      regressions: { searched: 2, heldOut: 1, total: 3 },
      maxRegressions: 2,
      exceedsRegressionLimit: true,
    });

    expect(over).toContain(
      "Against the live config it regressed on 3 tasks, over the line's regression limit of 2 (`max_regressions`), so weigh that before merging.",
    );
    expect(over).toContain(
      'Against the live config it regressed on 2 searched tasks; on the held-out tasks, 1 held-out task.',
    );
    expect(
      ConfigPullRequestBody.of({ ...FACTS, maxRegressions: 2 }),
    ).not.toContain('regression limit');
  });

  it('says when the regressions could not be counted yet', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      regressions: { searched: null, heldOut: null, total: null },
      heldOutPending: true,
    });

    expect(body).toContain(
      'Against the live config it could not be compared on the searched tasks; on the held-out tasks, its replay had not finished.',
    );
  });

  it('says what changes, was and now, with a long value folded away', () => {
    const body = ConfigPullRequestBody.of(FACTS);

    expect(body).toContain('## What changes');
    expect(body).toContain('- `effort`: `low` → `high`');
    expect(body).toContain(
      '- `prompt`: changed\n\n  <details><summary>Was and now</summary>',
    );
    expect(body).toContain(
      'Now:\n\n```text\nBuild it, then drain the queue.\nKeep the order.\n```',
    );
    expect(body).toContain(
      'This changes the station as the candidate has it: `prompt`, `effort`.',
    );
  });

  it('lists the held-out tasks, then the searched ones, each side with its reason in one line', () => {
    const body = ConfigPullRequestBody.of(FACTS);

    expect(body).toContain('## Task by task');
    expect(body.indexOf('### Held-out tasks')).toBeLessThan(
      body.indexOf('### Searched tasks'),
    );
    expect(body).toContain(
      '| Keep \\| the order | Succeeded: Checks passed. | Failed: Checks failed: npm test. | Yes |',
    );
    expect(body).toContain(
      '| Untitled task | Succeeded: Checks passed. | Succeeded: Judge passed it: The queue drains in order. | No |',
    );
  });

  it('caps each task table and says how many tasks it left out', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      tasks: {
        heldOut: Array.from({ length: 30 }, (_, at) => row(`Task ${at}`)),
        searched: [],
      },
    });

    expect(body).toContain('| Task 19 |');
    expect(body).not.toContain('| Task 20 |');
    expect(body).toContain('+10 more tasks.');
    expect(body).not.toContain('### Searched tasks');
  });

  it('says how the search ran, and what else Spotlight found', () => {
    const body = ConfigPullRequestBody.of(FACTS);

    expect(body).toContain('- Started by: a station alert');
    expect(body).toContain(
      '- Iterations: 3 of 3, with up to 2 candidates in each',
    );
    expect(body).toContain(
      '- Reflections: 1 of the iterations looked into why tasks failed',
    );
    expect(body).toContain('- Spent: 1.50 USD of the 5.00 USD ceiling');
    expect(body).toContain('- Search agent: claude-code · opus');
    expect(body).toContain('- Tasks: 7 searched, 3 held out');
    expect(body).toContain('- Replay set: 12 runs, refreshed 2026-10-27');
    expect(body).toContain(
      '- Noise: Success on the replay set moves by up to 6 points between repeats of the same runs. The line counts a gain of at least 5 points as real (`min_gain`).',
    );
    expect(body).toContain(
      '## What else Spotlight found\n\n- “Drain on restart”: the cause is the judge. Please fix the rubric of the judge.',
    );
    expect(ConfigPullRequestBody.of({ ...FACTS, found: [] })).not.toContain(
      '## What else Spotlight found',
    );
  });

  it('stays under the size limit of GitHub by leaving out whole sections from the end', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      found: Array.from({ length: 80 }, (_, at) => `${at} ${'y'.repeat(990)}`),
      tasks: {
        heldOut: Array.from({ length: 20 }, (_, at) =>
          row(`${at} ${'t'.repeat(300)}`, {
            candidate: {
              result: 'failed',
              successRate: 0,
              reason: 'r'.repeat(990),
            },
          }),
        ),
        searched: [],
      },
    });

    expect(body.length).toBeLessThan(65_536);
    expect(body).not.toContain('## What else Spotlight found');
    expect(body).toMatch(
      /Spotlight left out the last 1 section to keep this description under the limit of GitHub, 65536 characters\.$/,
    );
    expect((body.match(/```/g) ?? []).length % 2).toBe(0);
    expect((body.match(/<details>/g) ?? []).length).toBe(
      (body.match(/<\/details>/g) ?? []).length,
    );
  });

  it('escapes what a run, a judge or an agent wrote, so it cannot break the table or add markup', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      tasks: {
        heldOut: [
          row('Keep | order\nnext <!-- hidden --> </details>', {
            candidate: {
              result: 'failed',
              successRate: 0,
              reason:
                'Judge failed it: see [here](https://evil.test) and ![x](https://evil.test/x.png) @octocat.',
            },
          }),
        ],
        searched: [],
      },
      found: ['Fix it. <!-- ', '</details> and [a](https://evil.test)'],
    });
    const [line] = body.split('\n').filter((each) => each.startsWith('| Keep'));

    expect(line?.split(' | ')).toHaveLength(4);
    expect(body).not.toContain('<!--');
    expect(body).not.toMatch(/(^|[^\\])<\/details> and/);
    expect(body).not.toMatch(/(^|[^\\])\]\(https:/);
    expect(body).not.toMatch(/(^|[^\\])!\[x/);
    expect(body).toContain('@\u200boctocat');
  });

  it('caps a long task title', () => {
    const body = ConfigPullRequestBody.of({
      ...FACTS,
      tasks: { heldOut: [row('x'.repeat(500))], searched: [] },
    });
    const [line] = body.split('\n').filter((each) => each.startsWith('| xxx'));

    expect(line?.split(' | ')[0]?.length).toBeLessThanOrEqual(125);
    expect(line).toContain('…');
  });
});
