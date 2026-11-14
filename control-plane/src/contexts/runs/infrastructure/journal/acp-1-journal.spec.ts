import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isAcp1Journal,
  type JournalRow,
  rewrittenAcp1Journal,
} from '@runs/infrastructure/journal/acp-1-journal';
import { JournalBuilder } from '@runs/infrastructure/journal/journal-builder';
import { decoded } from '@runs/infrastructure/journal/journalled';
import { describe, expect, it } from 'vitest';

const RECORDINGS = join(
  __dirname,
  '../../../../../../data-plane/runner/internal/acp/testdata/claude-code/acp-1',
);

const SCENARIOS = [
  'background',
  'command',
  'edit',
  'plan',
  'refused',
  'subagent',
  'text',
];

const TURN_EVENTS = new Set(['turn.started', 'turn.ended', 'session.state']);

const encoded = (value: unknown): string =>
  Buffer.from(
    typeof value === 'string' ? value : JSON.stringify(value),
  ).toString('base64');

const clock = (at: number) => new Date(2026, 10, 14, 12, 0, at);

const linesOf = (file: string): unknown[] =>
  readFileSync(join(RECORDINGS, file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);

interface Recorded {
  readonly type: string;
  readonly data: unknown;
}

const paramsIn = (scenario: string): unknown[] =>
  linesOf(`${scenario}.frames.jsonl`).flatMap((line) => {
    const frame = line as { method?: string; params?: unknown };
    return frame.method === 'session/update' ? [frame.params] : [];
  });

const oldJournal = (scenario: string): JournalRow[] => {
  const frames = paramsIn(scenario).map((params, at) => ({
    seq: at + 2,
    type: 'output',
    at: clock(at + 1),
    message: null,
    data: encoded(params),
  }));

  return [
    {
      seq: 1,
      type: 'harness.connected',
      at: clock(0),
      message: 'acp/1',
      data: null,
    },
    ...frames,
    {
      seq: frames.length + 2,
      type: 'usage',
      at: clock(frames.length + 1),
      message: null,
      data: encoded({
        inputTokens: 120,
        outputTokens: 40,
        cachedReadTokens: 7,
      }),
    },
  ];
};

const eventsOf = (rows: readonly JournalRow[]): Recorded[] =>
  rows
    .filter(
      (row) => row.type !== 'harness.connected' && row.type !== 'harness.frame',
    )
    .map((row) => ({
      type: row.type,
      data: JSON.parse(decoded(row.data ?? '')) as unknown,
    }));

const stepsOf = (rows: readonly JournalRow[]) => {
  const builder = new JournalBuilder();
  for (const row of rows) {
    builder.take(row);
  }
  return builder
    .steps()
    .map(({ ms: _ms, startedAt: _startedAt, ...step }) => step);
};

const expectedRows = (scenario: string): JournalRow[] => [
  {
    seq: 1,
    type: 'harness.connected',
    at: clock(0),
    message: null,
    data: encoded({
      protocol: 'acp/1',
      events: 1,
      session: 'session_1',
      reports: {
        background: false,
        selfStartedTurns: false,
        turnUsage: true,
        commandOutput: false,
      },
    }),
  },
  ...(linesOf(`${scenario}.events.jsonl`) as Recorded[]).map((event, at) => ({
    seq: at + 2,
    type: event.type,
    at: clock(at + 1),
    message: null,
    data: encoded(event.data),
  })),
];

describe('rewrittenAcp1Journal', () => {
  it.each(SCENARIOS)(
    'gives the events that the runner gives for the %s recording',
    (scenario) => {
      const expected = (
        linesOf(`${scenario}.events.jsonl`) as Recorded[]
      ).filter((event) => !TURN_EVENTS.has(event.type));

      const rewritten = eventsOf(rewrittenAcp1Journal(oldJournal(scenario)));

      expect(rewritten.filter((event) => !TURN_EVENTS.has(event.type))).toEqual(
        expected,
      );
    },
  );

  it.each(SCENARIOS)(
    'shows the same steps as a new journal for the %s recording',
    (scenario) => {
      expect(stepsOf(rewrittenAcp1Journal(oldJournal(scenario)))).toEqual(
        stepsOf(expectedRows(scenario)),
      );
    },
  );

  it('announces the events with the root session of the old frames', () => {
    const [connected] = rewrittenAcp1Journal(oldJournal('subagent'));

    expect(connected).toMatchObject({
      seq: 1,
      type: 'harness.connected',
      message: null,
    });
    expect(JSON.parse(decoded(connected?.data ?? ''))).toEqual({
      protocol: 'acp/1',
      events: 1,
      session: 'session_1',
      reports: {
        background: false,
        selfStartedTurns: false,
        turnUsage: true,
        commandOutput: false,
      },
    });
  });

  it('keeps each old frame as a harness frame before its events', () => {
    const rows = rewrittenAcp1Journal(oldJournal('edit'));
    const frames = rows.filter((row) => row.type === 'harness.frame');

    expect(frames).toHaveLength(paramsIn('edit').length);
    expect(JSON.parse(decoded(frames[0]?.data ?? ''))).toEqual({
      protocol: 'acp/1',
      data: {
        jsonrpc: '2.0',
        method: 'session/update',
        params: paramsIn('edit')[0],
      },
    });
    expect(
      rows[rows.findIndex((row) => row.type === 'harness.frame') + 1]?.type,
    ).toBe('tool.changed');
  });

  it('ends a turn with its usage', () => {
    const rows = rewrittenAcp1Journal(oldJournal('text'));

    expect(eventsOf(rows)[eventsOf(rows).length - 1]).toEqual({
      type: 'turn.ended',
      data: {
        turn: 1,
        stop: 'ended',
        usage: { input: 120, output: 40, cacheRead: 7 },
      },
    });
    const builder = new JournalBuilder();
    for (const row of rows) {
      builder.take(row);
    }
    expect(builder.tokens().input).toBe(120);
  });

  it('starts a new message after a turn ends', () => {
    const said = (text: string) => ({
      sessionId: 'session_1',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text },
      },
    });
    const rows = rewrittenAcp1Journal([
      {
        seq: 1,
        type: 'output',
        at: clock(1),
        message: null,
        data: encoded(said('One.')),
      },
      {
        seq: 2,
        type: 'usage',
        at: clock(2),
        message: null,
        data: encoded({ inputTokens: 1 }),
      },
      {
        seq: 3,
        type: 'output',
        at: clock(3),
        message: null,
        data: encoded(said('Two.')),
      },
    ]);

    expect(
      eventsOf(rows)
        .filter((event) => event.type === 'message')
        .map((event) => (event.data as { id: string }).id),
    ).toEqual(['m1', 'm2']);
  });

  it('keeps the other rows in their place and numbers every row again', () => {
    const rows = rewrittenAcp1Journal([
      {
        seq: 3,
        type: 'output',
        at: clock(0),
        message: 'setup',
        data: encoded('npm ci'),
      },
      {
        seq: 5,
        type: 'working-copy.ready',
        at: clock(1),
        message: null,
        data: null,
      },
      {
        seq: 9,
        type: 'output',
        at: clock(2),
        message: null,
        data: encoded(paramsIn('text')[0]),
      },
      {
        seq: -1_000_000,
        type: 'tool.refused',
        at: clock(3),
        message: null,
        data: null,
      },
    ]);

    expect(rows.map(({ seq, type }) => [seq, type])).toEqual([
      [1, 'output'],
      [2, 'working-copy.ready'],
      [3, 'harness.connected'],
      [4, 'harness.frame'],
      [5, 'message'],
    ]);
    expect(rows[0]).toMatchObject({
      message: 'setup',
      data: encoded('npm ci'),
    });
  });

  it('knows an old journal from a new one', () => {
    expect(isAcp1Journal(oldJournal('text'))).toBe(true);
    expect(isAcp1Journal(rewrittenAcp1Journal(oldJournal('text')))).toBe(false);
  });
});
