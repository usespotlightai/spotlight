import { describe, expect, it } from 'vitest';
import type { TraceNodeResponseDto } from '@/lib/api';
import { answeredBy, askedOf, holdings, restOf, shaped } from '@/lib/detail';

const node = (
  part: Partial<TraceNodeResponseDto> & { id: string; name: string },
): TraceNodeResponseDto => ({
  kind: 'step',
  startedAt: '2026-08-29T12:00:00.000Z',
  ms: 1_000,
  tone: 'agent',
  cost: null,
  currency: null,
  step: null,
  span: null,
  children: [],
  ...part,
});

const step = (part: Record<string, unknown>) =>
  ({
    kind: 'tool',
    text: 'a tool',
    status: 'completed',
    tool: 'execute',
    detail: null,
    ms: 1_000,
    startedAt: '2026-08-29T12:00:00.000Z',
    locations: [],
    given: null,
    returned: null,
    change: null,
    ...part,
  }) as TraceNodeResponseDto['step'];

describe('shaped', () => {
  it('lays a shape out as the paths that lead to its values', () => {
    expect(
      shaped('{"query":"select:Read","max_results":3,"deep":false}'),
    ).toEqual([
      { path: 'query', value: '"select:Read"', kind: 'string' },
      { path: 'max_results', value: '3', kind: 'number' },
      { path: 'deep', value: 'false', kind: 'boolean' },
    ]);
  });

  it('names its way into what is nested', () => {
    expect(shaped('{"a":{"b":[1,null]}}')).toEqual([
      { path: 'a.b[0]', value: '1', kind: 'number' },
      { path: 'a.b[1]', value: 'null', kind: 'null' },
    ]);
  });

  // Terminal output and prose are not shapes, and pretending they are would
  // read worse than leaving them as they were written.
  it('says nothing of what was never a shape', () => {
    expect(shaped('sh: vitest: command not found')).toBeNull();
    expect(shaped('"just a string"')).toBeNull();
  });
});

describe('askedOf and answeredBy', () => {
  it('reads a tool by what it was given and what it returned', () => {
    const held = node({
      id: 'a',
      name: 'npm test',
      step: step({ given: '{"cmd":"npm test"}', detail: 'ok' }),
    });

    expect(askedOf(held)?.body).toBe('{"cmd":"npm test"}');
    expect(answeredBy(held)?.body).toBe('ok');
  });

  // A row named for its kind rather than its words leaves the words with
  // nowhere else to be read.
  it('reads what was said as the answer, where the row only says it spoke', () => {
    const held = node({
      id: 'b',
      name: 'Said',
      step: step({ kind: 'said', text: 'All done.' }),
    });

    expect(answeredBy(held)).toEqual({
      title: 'Message',
      body: 'All done.',
      prose: true,
    });
  });

  it('has nothing to say about a row that recorded nothing', () => {
    const held = node({ id: 'c', name: 'Prepare', kind: 'phase' });

    expect(askedOf(held)).toBeNull();
    expect(answeredBy(held)).toBeNull();
  });
});

describe('holdings', () => {
  // What a run or a phase is worth reading for: it has no words of its own.
  it('counts what sits beneath a row, by sort, however deep', () => {
    const held = holdings(
      node({
        id: 'run',
        name: 'Implementation',
        kind: 'run',
        children: [
          node({
            id: 'turn',
            name: 'Turn',
            kind: 'phase',
            children: [
              node({ id: '1', name: 'npm test', step: step({}) }),
              node({
                id: '2',
                name: 'Thought',
                tone: 'failed',
                step: step({ kind: 'thought' }),
              }),
            ],
          }),
        ],
      }),
    );

    expect(held.rows).toBe(3);
    expect(held.faults).toBe(1);
    expect([...held.kinds]).toEqual([
      ['Tools', 1],
      ['Thoughts', 1],
    ]);
  });
});

describe('restOf', () => {
  it('leaves out what the header already says', () => {
    const held = node({
      id: 'span',
      name: 'llm_request',
      kind: 'span',
      span: {
        id: 's1',
        parentId: null,
        name: 'claude_code.llm_request',
        startedAt: '2026-08-29T12:00:00.000Z',
        ms: 10,
        failed: false,
        attributes: [
          { name: 'gen_ai.request.model', value: 'claude-opus-5' },
          { name: 'gen_ai.request.temperature', value: '0.7' },
        ],
      },
    });

    expect(restOf(held).map((each) => each.name)).toEqual([
      'gen_ai.request.temperature',
    ]);
  });
});
