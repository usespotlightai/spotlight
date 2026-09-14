import type {
  JournalStep,
  RunJournal,
  RunSpan,
} from '@application/contracts/run-journal.contract';
import {
  paired,
  traceOf,
  type WorkedRun,
} from '@application/read-models/trace-of';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
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
  given: null,
  returned: null,
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
    spokeFrom: at(12_000),
    spokeTo: at(50_000),
    endedAt: at(60_000),
  },
  spent: null,
  ...part,
});

const worked = (part: Partial<WorkedRun> = {}): WorkedRun => ({
  id: RunId.of('run_1'),
  station: StationName.of('Implementation'),
  harness: HarnessName.of('claude-code'),
  state: 'completed',
  attempt: 1,
  startedAt: at(0),
  endedAt: at(60_000),
  journal: journal(),
  ...part,
});

const names = (nodes: readonly { name: string }[]) =>
  nodes.map((node) => node.name);

describe('traceOf', () => {
  it('holds every run that worked the task', () => {
    const trace = traceOf([
      worked({
        id: RunId.of('run_2'),
        startedAt: at(70_000),
        endedAt: at(90_000),
        journal: null,
      }),
      worked({ journal: null }),
    ]);

    expect(trace.roots).toHaveLength(2);
    expect(trace.roots[0]?.id).toBe('run:run_1');
    expect(trace.from?.getTime()).toBe(AT);
    expect(trace.to?.getTime()).toBe(AT + 90_000);
  });

  it('lays a run out as what it prepared, worked and published', () => {
    expect(names(traceOf([worked()]).roots[0]?.children ?? [])).toEqual([
      'Prepare',
      'Turn · claude-code',
      'Publish',
    ]);
  });

  it('draws only the phases the journal can account for', () => {
    const trace = traceOf([
      worked({
        journal: journal({
          marks: {
            startedAt: at(0),
            readyAt: null,
            spokeFrom: null,
            spokeTo: null,
            endedAt: at(6_000),
          },
        }),
      }),
    ]);

    expect(trace.roots[0]?.children ?? []).toEqual([]);
  });

  it('puts each step into the phase that holds it', () => {
    const trace = traceOf([
      worked({
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
      worked({
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

    expect(trace.faults).toBe(1);
  });

  it('tells the agent’s own work from the overhead around it', () => {
    const trace = traceOf([
      worked({
        journal: journal({
          steps: [
            step({
              kind: 'said',
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
      trace.roots[0]?.children[1]?.children.map((node) => node.tone),
    ).toEqual(['agent', 'overhead']);
  });

  describe('where the harness reports on itself', () => {
    it('draws one row where a span and a step are the same call', () => {
      const trace = traceOf([
        worked({
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
        worked({
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
        worked({
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

    it('hangs a span under the one that holds it', () => {
      const trace = traceOf([
        worked({
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
        worked({
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

    it('carries a failing span through as a fault', () => {
      const trace = traceOf([
        worked({
          journal: journal({
            spans: [span({ id: 's1', startedAt: at(20_000), failed: true })],
          }),
        }),
      ]);

      expect(trace.faults).toBe(1);
    });
  });

  it('reads a run whose harness reported nothing', () => {
    const trace = traceOf([
      worked({
        journal: journal({
          steps: [step({ text: 'npm test', startedAt: at(20_000), ms: 5_000 })],
        }),
      }),
    ]);

    const turn = trace.roots[0]?.children[1];
    expect(names(turn?.children ?? [])).toEqual(['npm test']);
    expect(turn?.children[0]?.span).toBeNull();
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
