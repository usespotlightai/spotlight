import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  JournalStep,
  RunJournal,
  RunSpan,
} from '@work/application/contracts/run-journal.contract';
import {
  paired,
  type TracedRun,
  traceOf,
} from '@work/application/read-models/trace-of';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { RunConnection } from '@work/domain/value-objects/run-connection.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const AT = Date.UTC(2026, 7, 29, 12, 0, 0);
const at = (ms: number) => new Date(AT + ms);

const step = (
  part: Partial<JournalStep> & { startedAt: Date; ms: number },
): JournalStep => ({
  kind: 'tool',
  text: 'a tool',
  status: 'completed',
  tool: 'execute',
  detail: null,
  locations: [],
  input: null,
  output: null,
  change: null,
  ...part,
});

const span = (
  part: Partial<RunSpan> & { id: string; startedAt: Date },
): RunSpan => ({
  parentId: null,
  name: 'claude_code.tool',
  ms: 1_000,
  failed: false,
  attributes: [],
  ...part,
});

const journal = (part: Partial<RunJournal> = {}): RunJournal => ({
  runId: 'run_1',
  attempt: 1,
  steps: [],
  spans: [],
  ms: 0,
  marks: {
    startedAt: at(0),
    readyAt: at(10_000),
    firstAgentUpdateAt: at(12_000),
    lastAgentUpdateAt: at(50_000),
    endedAt: at(60_000),
  },
  spent: null,
  egressEnforcement: null,
  ...part,
});

const tracedRun = (part: Partial<TracedRun> = {}): TracedRun => ({
  id: RunId.of('run_1'),
  station: StationName.of('Implementation'),
  harness: HarnessName.of('claude-code'),
  state: 'completed',
  attempt: 1,
  startedAt: at(0),
  endedAt: at(60_000),
  journal: journal(),
  connections: [],
  ...part,
});

const connection = (
  part: Partial<Parameters<typeof RunConnection.of>[0]> & { at: Date },
) =>
  RunConnection.of({
    host: 'paste.example.net',
    port: 443,
    bytesOut: 0,
    bytesIn: 0,
    ms: 10,
    outcome: 'blocked',
    status: null,
    reason: 'not-allowed',
    ...part,
  });

const names = (nodes: readonly { name: string }[]) =>
  nodes.map((node) => node.name);

describe('traceOf', () => {
  it('has every run that worked the task', () => {
    const trace = traceOf([
      tracedRun({
        id: RunId.of('run_2'),
        startedAt: at(70_000),
        endedAt: at(90_000),
        journal: null,
      }),
      tracedRun({ journal: null }),
    ]);

    expect(trace.roots).toHaveLength(2);
    expect(trace.roots[0]?.id).toBe('run:run_1');
    expect(trace.from?.getTime()).toBe(AT);
    expect(trace.to?.getTime()).toBe(AT + 90_000);
  });

  it('lays a run out as what it prepared, worked and published', () => {
    expect(names(traceOf([tracedRun()]).roots[0]?.children ?? [])).toEqual([
      'Prepare',
      'Turn · claude-code',
      'Publish',
    ]);
  });

  it('draws only the phases the journal can account for', () => {
    const trace = traceOf([
      tracedRun({
        journal: journal({
          marks: {
            startedAt: at(0),
            readyAt: null,
            firstAgentUpdateAt: null,
            lastAgentUpdateAt: null,
            endedAt: at(6_000),
          },
        }),
      }),
    ]);

    expect(trace.roots[0]?.children ?? []).toEqual([]);
  });

  it('puts each step into the phase that contains it', () => {
    const trace = traceOf([
      tracedRun({
        journal: journal({
          steps: [
            step({
              kind: 'hook',
              text: 'prepare',
              startedAt: at(1_000),
              ms: 8_000,
            }),
            step({ text: 'npm test', startedAt: at(20_000), ms: 5_000 }),
            step({
              kind: 'hook',
              text: 'publish',
              startedAt: at(52_000),
              ms: 2_000,
            }),
          ],
        }),
      }),
    ]);

    const [prepare, turn, publish] = trace.roots[0]?.children ?? [];
    expect(names(prepare?.children ?? [])).toEqual(['prepare']);
    expect(names(turn?.children ?? [])).toEqual(['npm test']);
    expect(names(publish?.children ?? [])).toEqual(['publish']);
  });

  it('counts what went wrong, however deep it sits', () => {
    const trace = traceOf([
      tracedRun({
        journal: journal({
          steps: [
            step({
              text: 'npm test',
              status: 'failed',
              startedAt: at(20_000),
              ms: 5_000,
            }),
          ],
        }),
      }),
    ]);

    expect(trace.errors).toBe(1);
  });

  it('tells the agent’s own work from the overhead around it', () => {
    const trace = traceOf([
      tracedRun({
        journal: journal({
          steps: [
            step({
              kind: 'message',
              text: 'Done.',
              startedAt: at(20_000),
              ms: 100,
            }),
            step({
              kind: 'planned',
              text: 'Planned 2 steps',
              startedAt: at(21_000),
              ms: 0,
            }),
          ],
        }),
      }),
    ]);

    expect(
      trace.roots[0]?.children[1]?.children.map((node) => node.category),
    ).toEqual(['agent', 'overhead']);
  });

  describe('where the harness reports on itself', () => {
    it('draws one row where a span and a step are the same call', () => {
      const trace = traceOf([
        tracedRun({
          journal: journal({
            steps: [
              step({ text: 'npm test', startedAt: at(20_000), ms: 5_000 }),
            ],
            spans: [span({ id: 's1', startedAt: at(20_100), ms: 4_800 })],
          }),
        }),
      ]);

      const turn = trace.roots[0]?.children[1];
      expect(turn?.children).toHaveLength(1);
      expect(turn?.children[0]?.name).toBe('npm test');
      expect(turn?.children[0]?.span?.id).toBe('s1');
      expect(turn?.children[0]?.step?.text).toBe('npm test');
    });

    it('keeps a span that matches nothing, without inventing detail for it', () => {
      const trace = traceOf([
        tracedRun({
          journal: journal({
            spans: [
              span({
                id: 's1',
                name: 'claude_code.llm_request',
                startedAt: at(20_000),
              }),
            ],
          }),
        }),
      ]);

      const turn = trace.roots[0]?.children[1];
      expect(turn?.children[0]?.name).toBe('llm_request');
      expect(turn?.children[0]?.step).toBeNull();
    });

    it('keeps a step the harness never mentioned', () => {
      const trace = traceOf([
        tracedRun({
          journal: journal({
            steps: [
              step({ text: 'npm test', startedAt: at(20_000), ms: 5_000 }),
            ],
            spans: [
              span({
                id: 's1',
                name: 'claude_code.llm_request',
                startedAt: at(30_000),
              }),
            ],
          }),
        }),
      ]);

      expect(names(trace.roots[0]?.children[1]?.children ?? [])).toEqual([
        'npm test',
        'llm_request',
      ]);
    });

    it('hangs a span under the one that contains it', () => {
      const trace = traceOf([
        tracedRun({
          journal: journal({
            spans: [
              span({
                id: 'inner',
                parentId: 'outer',
                name: 'claude_code.llm_request',
                startedAt: at(21_000),
              }),
              span({
                id: 'outer',
                name: 'claude_code.interaction',
                startedAt: at(20_000),
                ms: 10_000,
              }),
            ],
          }),
        }),
      ]);

      const turn = trace.roots[0]?.children[1];
      expect(names(turn?.children ?? [])).toEqual(['interaction']);
      expect(names(turn?.children[0]?.children ?? [])).toEqual(['llm_request']);
    });

    it('draws a span whose parent is nowhere to be found', () => {
      const trace = traceOf([
        tracedRun({
          journal: journal({
            spans: [
              span({
                id: 'inner',
                parentId: 'gone',
                startedAt: at(21_000),
              }),
            ],
          }),
        }),
      ]);

      expect(trace.roots[0]?.children[1]?.children).toHaveLength(1);
    });

    it('carries a failing span through as an error', () => {
      const trace = traceOf([
        tracedRun({
          journal: journal({
            spans: [span({ id: 's1', startedAt: at(20_000), failed: true })],
          }),
        }),
      ]);

      expect(trace.errors).toBe(1);
    });
  });

  it('reads a run whose harness reported nothing', () => {
    const trace = traceOf([
      tracedRun({
        journal: journal({
          steps: [step({ text: 'npm test', startedAt: at(20_000), ms: 5_000 })],
        }),
      }),
    ]);

    const turn = trace.roots[0]?.children[1];
    expect(names(turn?.children ?? [])).toEqual(['npm test']);
    expect(turn?.children[0]?.span).toBeNull();
  });

  describe('connections', () => {
    const npmTest = journal({
      steps: [step({ text: 'npm test', startedAt: at(20_000), ms: 5_000 })],
    });

    it('puts a connection with an error under the step that was open when it started', () => {
      const trace = traceOf([
        tracedRun({
          journal: npmTest,
          connections: [connection({ at: at(21_000) })],
        }),
      ]);

      const test = trace.roots[0]?.children[1]?.children[0];
      expect(test?.name).toBe('npm test');
      expect(test?.children).toMatchObject([
        {
          id: 'run_1:connection:0',
          kind: 'connection',
          name: 'paste.example.net',
          category: 'failed',
          from: at(21_000),
          connection: { count: 1 },
        },
      ]);
      expect(trace.errors).toBe(0);
    });

    it('ends a connection row no later than the row that contains it', () => {
      const trace = traceOf([
        tracedRun({
          journal: npmTest,
          connections: [connection({ at: at(24_000), ms: 9_000 })],
        }),
      ]);

      expect(trace.roots[0]?.children[1]?.children[0]?.children[0]?.to).toEqual(
        at(25_000),
      );
    });

    it('puts a connection that no step contains into the phase or the run', () => {
      const trace = traceOf([
        tracedRun({
          journal: npmTest,
          connections: [
            connection({ at: at(30_000) }),
            connection({ at: at(90_000), host: 'late.example.net' }),
          ],
        }),
      ]);

      const run = trace.roots[0];
      expect(names(run?.children[1]?.children ?? [])).toEqual([
        'npm test',
        'paste.example.net',
      ]);
      expect(names(run?.children ?? [])).toEqual([
        'Prepare',
        'Turn · claude-code',
        'Publish',
        'late.example.net',
      ]);
    });

    it('draws the same failure in one place as one row, and counts it', () => {
      const trace = traceOf([
        tracedRun({
          journal: npmTest,
          connections: [
            connection({ at: at(21_000) }),
            connection({ at: at(22_000) }),
            connection({ at: at(23_000), ms: 500 }),
            connection({ at: at(24_000), reason: 'private-address' }),
          ],
        }),
      ]);

      const rows = trace.roots[0]?.children[1]?.children[0]?.children ?? [];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        from: at(21_000),
        to: at(23_500),
        connection: { count: 3 },
      });
      expect(rows[1]?.connection?.connection.reason).toBe('private-address');
    });

    it('leaves out connections without an error', () => {
      const trace = traceOf([
        tracedRun({
          journal: npmTest,
          connections: [
            connection({
              at: at(21_000),
              outcome: 'passthrough',
              reason: null,
            }),
            connection({
              at: at(21_200),
              outcome: 'injected',
              reason: null,
              status: 429,
            }),
            connection({
              at: at(21_500),
              outcome: 'injected',
              reason: null,
              status: 404,
            }),
            connection({
              at: at(22_000),
              host: 'api.linear.app',
              outcome: 'injected',
              reason: null,
              status: 401,
            }),
          ],
        }),
      ]);

      const test = trace.roots[0]?.children[1]?.children[0];
      expect(names(test?.children ?? [])).toEqual(['api.linear.app']);
    });

    it('names the port when it is not 443', () => {
      const trace = traceOf([
        tracedRun({
          journal: null,
          connections: [connection({ at: at(1_000), port: 5432 })],
        }),
      ]);

      expect(names(trace.roots[0]?.children ?? [])).toEqual([
        'paste.example.net:5432',
      ]);
    });
  });

  it('tells on the run row whether egress was enforced', () => {
    expect(
      traceOf([
        tracedRun({ journal: journal({ egressEnforcement: 'not-enforced' }) }),
      ]).roots[0]?.egressEnforcement,
    ).toBe('not-enforced');
    expect(
      traceOf([tracedRun({ journal: null })]).roots[0]?.egressEnforcement,
    ).toBeNull();
  });
});

describe('paired', () => {
  it('takes the earliest tool each span could be', () => {
    const first = step({ text: 'first', startedAt: at(1_000), ms: 1_000 });
    const second = step({ text: 'second', startedAt: at(3_000), ms: 1_000 });

    const pairs = paired(
      [
        span({ id: 'b', startedAt: at(3_100), ms: 800 }),
        span({ id: 'a', startedAt: at(1_100), ms: 800 }),
      ],
      [second, first],
    );

    expect(pairs.get('a')).toBe(first);
    expect(pairs.get('b')).toBe(second);
  });

  it('never gives one step to two spans', () => {
    const once = step({ text: 'once', startedAt: at(1_000), ms: 4_000 });

    const pairs = paired(
      [
        span({ id: 'a', startedAt: at(1_100), ms: 500 }),
        span({ id: 'b', startedAt: at(2_000), ms: 500 }),
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
          startedAt: at(1_000),
        }),
      ],
      [step({ text: 'a tool', startedAt: at(1_000), ms: 4_000 })],
    );

    expect(pairs.size).toBe(0);
  });

  it('leaves a span alone when nothing was happening near it', () => {
    const pairs = paired(
      [span({ id: 'a', startedAt: at(90_000), ms: 100 })],
      [step({ text: 'a tool', startedAt: at(1_000), ms: 1_000 })],
    );

    expect(pairs.size).toBe(0);
  });
});
