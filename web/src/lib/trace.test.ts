import { describe, expect, it } from 'vitest';
import type {
  JournalStepResponseDto,
  RunJournalResponseDto,
  RunSpanResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';
import { laidOut, only, paired, rowsOf, says, traceOf } from '@/lib/trace';

const AT = Date.UTC(2026, 7, 29, 12, 0, 0);
const iso = (ms: number) => new Date(AT + ms).toISOString();

const step = (
  part: Partial<JournalStepResponseDto> & { startedAt: string; ms: number },
): JournalStepResponseDto =>
  ({
    kind: 'tool',
    text: 'a tool',
    status: 'completed',
    tool: 'execute',
    detail: null,
    locations: [],
    given: null,
    returned: null,
    change: null,
    ...part,
  }) as JournalStepResponseDto;

const span = (
  part: Partial<RunSpanResponseDto> & { id: string; startedAt: string },
): RunSpanResponseDto =>
  ({
    parentId: null,
    name: 'claude_code.tool',
    ms: 1_000,
    failed: false,
    attributes: [],
    ...part,
  }) as RunSpanResponseDto;

const run = (part: Partial<TaskRunResponseDto> = {}): TaskRunResponseDto =>
  ({
    id: 'run_1',
    state: 'completed',
    attempt: 1,
    exitCode: 0,
    startedAt: iso(0),
    updatedAt: iso(60_000),
    harness: 'claude-code',
    station: {
      name: 'Implementation',
      color: '#edc12b',
      position: 1,
      count: 3,
    },
    review: null,
    ...part,
  }) as TaskRunResponseDto;

const journal = (
  part: Partial<RunJournalResponseDto> = {},
): RunJournalResponseDto =>
  ({
    runId: 'run_1',
    attempt: 1,
    steps: [],
    spans: [],
    ms: 0,
    marks: {
      startedAt: iso(0),
      readyAt: iso(10_000),
      spokeFrom: iso(12_000),
      spokeTo: iso(50_000),
      endedAt: iso(60_000),
    },
    spent: null,
    readable: true,
    ...part,
  }) as RunJournalResponseDto;

const names = (nodes: readonly { name: string }[]) =>
  nodes.map((node) => node.name);

describe('traceOf', () => {
  // The task is the trace, not the run: a task that came back from review is
  // the interesting one, and its second run belongs beside its first.
  it('holds every run that worked the task', () => {
    const trace = traceOf(
      [
        run({ id: 'run_2', startedAt: iso(70_000), updatedAt: iso(90_000) }),
        run(),
      ],
      [],
    );

    expect(trace.roots).toHaveLength(2);
    expect(trace.roots[0]?.id).toBe('run:run_1');
    expect(trace.from).toBe(AT);
    expect(trace.to).toBe(AT + 90_000);
  });

  it('lays a run out as what it prepared, worked and published', () => {
    const trace = traceOf([run()], [journal()]);

    expect(names(trace.roots[0]?.children ?? [])).toEqual([
      'Prepare',
      'Turn',
      'Publish',
    ]);
  });

  // Where a stretch cannot be vouched for it is not drawn: a run that never
  // reached its agent has no turn to show.
  it('draws only the phases the journal can account for', () => {
    const trace = traceOf(
      [run()],
      [
        journal({
          marks: {
            startedAt: iso(0),
            readyAt: null,
            spokeFrom: null,
            spokeTo: null,
            endedAt: iso(6_000),
          },
        }),
      ],
    );

    expect(trace.roots[0]?.children ?? []).toEqual([]);
  });

  it('puts each step into the phase that holds it', () => {
    const trace = traceOf(
      [run()],
      [
        journal({
          steps: [
            step({
              kind: 'hook',
              text: 'prepare',
              startedAt: iso(1_000),
              ms: 8_000,
            }),
            step({ text: 'npm test', startedAt: iso(20_000), ms: 5_000 }),
            step({
              kind: 'hook',
              text: 'publish',
              startedAt: iso(52_000),
              ms: 2_000,
            }),
          ],
        }),
      ],
    );

    const [prepare, turn, publish] = trace.roots[0]?.children ?? [];
    expect(names(prepare?.children ?? [])).toEqual(['prepare']);
    expect(names(turn?.children ?? [])).toEqual(['npm test']);
    expect(names(publish?.children ?? [])).toEqual(['publish']);
  });

  it('counts what went wrong, however deep it sits', () => {
    const trace = traceOf(
      [run()],
      [
        journal({
          steps: [
            step({
              text: 'npm test',
              status: 'failed',
              startedAt: iso(20_000),
              ms: 5_000,
            }),
          ],
        }),
      ],
    );

    expect(trace.errors).toBe(1);
  });

  // A hook is the deployment's code and a plan is talk about work: neither is
  // the run getting on with it, and both recede.
  it('tells the agent’s own work from the overhead around it', () => {
    const trace = traceOf(
      [run()],
      [
        journal({
          steps: [
            step({
              kind: 'said',
              text: 'Done.',
              startedAt: iso(20_000),
              ms: 100,
            }),
            step({
              kind: 'planned',
              text: 'Planned 2 steps',
              startedAt: iso(21_000),
              ms: 0,
            }),
          ],
        }),
      ],
    );

    const turn = trace.roots[0]?.children[1];
    expect(turn?.children.map((node) => node.tone)).toEqual([
      'agent',
      'overhead',
    ]);
  });

  describe('where the harness reports on itself', () => {
    // The protocol and the harness describe the same tool call. Two rows for
    // one thing is the whole risk in merging them.
    it('draws one row where a span and a step are the same call', () => {
      const trace = traceOf(
        [run()],
        [
          journal({
            steps: [
              step({ text: 'npm test', startedAt: iso(20_000), ms: 5_000 }),
            ],
            spans: [span({ id: 's1', startedAt: iso(20_100), ms: 4_800 })],
          }),
        ],
      );

      const turn = trace.roots[0]?.children[1];
      expect(turn?.children).toHaveLength(1);
      // The agent's name for the tool beats the harness's name for the span.
      expect(turn?.children[0]?.name).toBe('npm test');
      expect(turn?.children[0]?.span?.id).toBe('s1');
      expect(turn?.children[0]?.step?.text).toBe('npm test');
    });

    it('keeps a span that matches nothing, without inventing detail for it', () => {
      const trace = traceOf(
        [run()],
        [
          journal({
            spans: [
              span({
                id: 's1',
                name: 'claude_code.llm_request',
                startedAt: iso(20_000),
              }),
            ],
          }),
        ],
      );

      const turn = trace.roots[0]?.children[1];
      expect(turn?.children[0]?.name).toBe('llm_request');
      expect(turn?.children[0]?.step).toBeNull();
    });

    it('keeps a step the harness never mentioned', () => {
      const trace = traceOf(
        [run()],
        [
          journal({
            steps: [
              step({ text: 'npm test', startedAt: iso(20_000), ms: 5_000 }),
            ],
            spans: [
              span({
                id: 's1',
                name: 'claude_code.llm_request',
                startedAt: iso(30_000),
              }),
            ],
          }),
        ],
      );

      const turn = trace.roots[0]?.children[1];
      expect(names(turn?.children ?? [])).toEqual(['npm test', 'llm_request']);
    });

    it('hangs a span under the one that holds it', () => {
      const trace = traceOf(
        [run()],
        [
          journal({
            spans: [
              span({
                id: 'inner',
                parentId: 'outer',
                name: 'claude_code.llm_request',
                startedAt: iso(21_000),
              }),
              span({
                id: 'outer',
                name: 'claude_code.interaction',
                startedAt: iso(20_000),
                ms: 10_000,
              }),
            ],
          }),
        ],
      );

      const turn = trace.roots[0]?.children[1];
      expect(names(turn?.children ?? [])).toEqual(['interaction']);
      expect(names(turn?.children[0]?.children ?? [])).toEqual(['llm_request']);
    });

    // The parent may be a span this run never exported, or one the runner
    // never took. It is still a row worth drawing.
    it('draws a span whose parent is nowhere to be found', () => {
      const trace = traceOf(
        [run()],
        [
          journal({
            spans: [
              span({
                id: 'inner',
                parentId: 'gone',
                name: 'claude_code.tool',
                startedAt: iso(21_000),
              }),
            ],
          }),
        ],
      );

      const turn = trace.roots[0]?.children[1];
      expect(turn?.children).toHaveLength(1);
    });

    it('carries a failing span through as a fault', () => {
      const trace = traceOf(
        [run()],
        [
          journal({
            spans: [span({ id: 's1', startedAt: iso(20_000), failed: true })],
          }),
        ],
      );

      expect(trace.errors).toBe(1);
    });
  });

  // Nothing is missing on a harness that says nothing about itself; there are
  // only fewer rows than there would otherwise be.
  it('reads a run whose harness reported nothing', () => {
    const trace = traceOf(
      [run()],
      [
        journal({
          steps: [
            step({ text: 'npm test', startedAt: iso(20_000), ms: 5_000 }),
          ],
        }),
      ],
    );

    const turn = trace.roots[0]?.children[1];
    expect(names(turn?.children ?? [])).toEqual(['npm test']);
    expect(turn?.children[0]?.span).toBeNull();
  });
});

describe('paired', () => {
  it('takes the earliest tool each span could be', () => {
    const first = step({ text: 'first', startedAt: iso(1_000), ms: 1_000 });
    const second = step({ text: 'second', startedAt: iso(3_000), ms: 1_000 });

    const pairs = paired(
      [
        span({ id: 'b', startedAt: iso(3_100), ms: 800 }),
        span({ id: 'a', startedAt: iso(1_100), ms: 800 }),
      ],
      [second, first],
    );

    expect(pairs.get('a')).toBe(first);
    expect(pairs.get('b')).toBe(second);
  });

  it('never gives one step to two spans', () => {
    const once = step({ text: 'once', startedAt: iso(1_000), ms: 4_000 });

    const pairs = paired(
      [
        span({ id: 'a', startedAt: iso(1_100), ms: 500 }),
        span({ id: 'b', startedAt: iso(2_000), ms: 500 }),
      ],
      [once],
    );

    expect(pairs.get('a')).toBe(once);
    expect(pairs.get('b')).toBeUndefined();
  });

  it('pairs nothing with a span that is not a tool at all', () => {
    const pairs = paired(
      [
        span({
          id: 'a',
          name: 'claude_code.llm_request',
          startedAt: iso(1_000),
        }),
      ],
      [step({ text: 'a tool', startedAt: iso(1_000), ms: 4_000 })],
    );

    expect(pairs.size).toBe(0);
  });

  it('leaves a span alone when nothing was happening near it', () => {
    const pairs = paired(
      [span({ id: 'a', startedAt: iso(90_000), ms: 100 })],
      [step({ text: 'a tool', startedAt: iso(1_000), ms: 1_000 })],
    );

    expect(pairs.size).toBe(0);
  });
});

describe('rowsOf', () => {
  const trace = () =>
    traceOf(
      [run()],
      [
        journal({
          steps: [
            step({ text: 'npm test', startedAt: iso(20_000), ms: 5_000 }),
          ],
        }),
      ],
    );

  // A phase that held nothing is still drawn: ten seconds of preparation with
  // nothing to show for it is the whole point of looking.
  it('draws the tree deepest last, saying how deep each row is', () => {
    const rows = rowsOf(trace().roots, new Set());

    expect(rows.map((row) => [row.node.name, row.depth])).toEqual([
      ['Implementation · claude-code', 0],
      ['Prepare', 1],
      ['Turn', 1],
      ['npm test', 2],
      ['Publish', 1],
    ]);
  });

  it('holds back what a closed row is holding, and says how much', () => {
    const rows = rowsOf(trace().roots, new Set(['run:run_1']));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.children).toBe(3);
  });

  it('holds back only what sits under the row that is closed', () => {
    const rows = rowsOf(trace().roots, new Set([`${run().id}:turn`]));

    expect(rows.map((row) => row.node.name)).toEqual([
      'Implementation · claude-code',
      'Prepare',
      'Turn',
      'Publish',
    ]);
  });
});

describe('only', () => {
  const searched = () =>
    traceOf(
      [run()],
      [
        journal({
          steps: [
            step({ text: 'npm test', startedAt: iso(20_000), ms: 1_000 }),
            step({
              text: 'Edit',
              startedAt: iso(30_000),
              ms: 1_000,
              locations: [{ path: 'src/queue.ts', line: 12 }],
            }),
          ],
        }),
      ],
    );

  it('keeps a row that matches, and whatever it hangs from', () => {
    const rows = rowsOf(only(searched().roots, 'npm'), new Set());

    expect(rows.map((row) => row.node.name)).toEqual([
      'Implementation · claude-code',
      'Turn',
      'npm test',
    ]);
  });

  // Where a step reached is as much a part of it as what it was called.
  it('finds a step by the file it touched', () => {
    const rows = rowsOf(only(searched().roots, 'queue.ts'), new Set());

    expect(rows.map((row) => row.node.name)).toContain('Edit');
    expect(rows.map((row) => row.node.name)).not.toContain('npm test');
  });

  it('keeps everything when nothing was asked for', () => {
    expect(only(searched().roots, '  ')).toHaveLength(1);
  });
});

describe('says', () => {
  it('finds a span by what it reported about itself', () => {
    const trace = traceOf(
      [run()],
      [
        journal({
          spans: [
            span({
              id: 's1',
              name: 'claude_code.llm_request',
              startedAt: iso(20_000),
              attributes: [
                { name: 'gen_ai.request.model', value: 'claude-opus-5' },
              ],
            }),
          ],
        }),
      ],
    );

    const node = trace.roots[0]?.children[1]?.children[0];
    expect(node && says(node, 'opus')).toBe(true);
    expect(node && says(node, 'sonnet')).toBe(false);
  });
});

describe('laidOut', () => {
  it('places a bar where it belongs in the whole', () => {
    const trace = traceOf([run()], [journal()]);
    const turn = trace.roots[0]?.children[1];

    // The turn runs from twelve seconds to fifty, of a minute.
    expect(turn && laidOut(turn, trace)).toEqual({
      left: 20,
      width: (38 / 60) * 100,
    });
  });
});
