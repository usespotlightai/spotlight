import { describe, expect, it } from 'vitest';
import type { TraceNodeResponseDto } from '@/lib/api';
import { laidOut, rowsOf, type Trace } from '@/lib/trace';

const AT = Date.UTC(2026, 7, 29, 12, 0, 0);
const iso = (ms: number) => new Date(AT + ms).toISOString();

const node = (
  part: Partial<TraceNodeResponseDto> & { id: string; name: string },
): TraceNodeResponseDto => ({
  kind: 'step',
  startedAt: iso(0),
  ms: 1_000,
  tone: 'agent',
  cost: null,
  currency: null,
  step: null,
  span: null,
  connection: null,
  egress: null,
  children: [],
  ...part,
});

const trace = (): Trace => ({
  startedAt: iso(0),
  ms: 60_000,
  rows: 4,
  faults: 0,
  roots: [
    node({
      id: 'run:run_1',
      name: 'Implementation',
      kind: 'run',
      ms: 60_000,
      children: [
        node({
          id: 'run_1:turn',
          name: 'Turn · claude-code',
          kind: 'phase',
          startedAt: iso(12_000),
          ms: 38_000,
          children: [
            node({
              id: 'run_1:step:0',
              name: 'npm test',
              startedAt: iso(20_000),
              step: {
                kind: 'tool',
                text: 'npm test',
                status: 'completed',
                tool: 'execute',
                detail: null,
                ms: 1_000,
                startedAt: iso(20_000),
                locations: [],
                given: null,
                returned: null,
                change: null,
              },
            }),
            node({
              id: 'run_1:step:1',
              name: 'Edit',
              startedAt: iso(30_000),
              step: {
                kind: 'tool',
                text: 'Edit',
                status: 'completed',
                tool: 'edit',
                detail: null,
                ms: 1_000,
                startedAt: iso(30_000),
                locations: [{ path: 'src/queue.ts', line: 12 }],
                given: null,
                returned: null,
                change: null,
              },
            }),
          ],
        }),
      ],
    }),
  ],
});

describe('rowsOf', () => {
  it('draws the tree deepest last, saying how deep each row is', () => {
    expect(
      rowsOf(trace().roots, new Set()).map((row) => [row.node.name, row.depth]),
    ).toEqual([
      ['Implementation', 0],
      ['Turn · claude-code', 1],
      ['npm test', 2],
      ['Edit', 2],
    ]);
  });

  it('hides what a closed row contains, and says how much', () => {
    const rows = rowsOf(trace().roots, new Set(['run:run_1']));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.children).toBe(1);
  });

  it('hides only what sits under the row that is closed', () => {
    const rows = rowsOf(trace().roots, new Set(['run_1:turn']));

    expect(rows.map((row) => row.node.name)).toEqual([
      'Implementation',
      'Turn · claude-code',
    ]);
  });
});

describe('laidOut', () => {
  it('places a bar where it belongs in the whole', () => {
    const tree = trace();
    const turn = tree.roots[0]?.children[0];

    expect(turn && laidOut(turn, tree)).toEqual({
      left: 20,
      width: (38 / 60) * 100,
    });
  });
});
