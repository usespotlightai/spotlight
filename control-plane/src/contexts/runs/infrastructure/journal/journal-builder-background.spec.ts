import {
  AGENT_REMINDED,
  BACKGROUND_LOST,
  BACKGROUND_SETTLED,
  BACKGROUND_WAITING,
  HARNESS_CONNECTED,
} from '@runs/domain/value-objects/journal-entry-type';
import { JournalBuilder } from '@runs/infrastructure/journal/journal-builder';
import type { Journalled } from '@runs/infrastructure/journal/journalled';
import { describe, expect, it } from 'vitest';

const encoded = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64');

const entry = (
  type: string,
  message: string | null,
  data: unknown = null,
): Omit<Journalled, 'at'> => ({
  type,
  message,
  data: data === null ? null : encoded(data),
});

const event = (type: string, data: Record<string, unknown>) =>
  entry(type, null, data);

const connected = (events = 1) =>
  event(HARNESS_CONNECTED, {
    protocol: 'acp/1',
    events,
    reports: {
      background: true,
      selfStartedTurns: false,
      turnUsage: true,
      commandOutput: false,
    },
  });

const said = (text: string, session?: string, id = 'm1') =>
  event('message', { session, id, role: 'agent', text });

const clock = (at: number) => new Date(2026, 10, 9, 12, 0, at);

const play = (...entries: Omit<Journalled, 'at'>[]) => {
  const builder = new JournalBuilder();
  entries.forEach((each, at) => {
    builder.take({ ...each, at: clock(at) });
  });
  return builder;
};

const read = (...entries: Omit<Journalled, 'at'>[]) =>
  play(connected(), ...entries);

const shown = (builder: JournalBuilder) =>
  builder.steps().map(({ kind, text, status, detail, input, output }) => ({
    kind,
    text,
    status,
    detail,
    input,
    output,
  }));

const tests = [{ id: 't1', kind: 'local_bash', description: 'npx vitest run' }];

describe('JournalBuilder, harness connection', () => {
  it('reads the events of a harness once it connected', () => {
    const builder = play(connected(), said('Done.'));

    expect(builder.steps().map((step) => step.text)).toEqual(['Done.']);
  });

  it('reads no events before the harness connected', () => {
    const builder = play(said('Done.'));

    expect(builder.steps()).toEqual([]);
  });

  it('reads no events of a version it does not know', () => {
    const builder = play(connected(2), said('Done.'));

    expect(builder.steps()).toEqual([]);
  });
});

describe('JournalBuilder, background work', () => {
  it('shows the reminder to hand over', () => {
    const builder = read(
      said('Pushed.'),
      entry(AGENT_REMINDED, 'Your turn ended without a handover.'),
    );

    expect(shown(builder)[1]).toEqual({
      kind: 'reminded',
      text: 'the agent to hand over',
      status: null,
      detail: 'Your turn ended without a handover.',
      input: null,
      output: null,
    });
  });

  it('shows a wait for background work as one step that ends when it settles', () => {
    const builder = read(
      said('Started the tests.'),
      entry(BACKGROUND_WAITING, null, { tasks: tests }),
      said('The tests passed.'),
      entry(BACKGROUND_SETTLED, null, { tasks: [], ended: 'settled' }),
    );

    const steps = builder.steps();
    expect(steps.map((step) => [step.kind, step.text, step.status])).toEqual([
      ['message', 'Started the tests.', null],
      ['waited', 'npx vitest run', 'completed'],
      ['message', 'The tests passed.', null],
    ]);
    expect(steps[1]?.ms).toBe(2000);
  });

  it('says what still ran at the wait limit', () => {
    const builder = read(
      entry(BACKGROUND_WAITING, null, { tasks: tests }),
      entry(BACKGROUND_SETTLED, null, { tasks: tests, ended: 'limit' }),
    );

    expect(shown(builder)[0]?.detail).toBe(
      'Still running at the wait limit: npx vitest run',
    );
  });

  it('says a person cut the wait short, not that it reached its limit', () => {
    const builder = read(
      entry(BACKGROUND_WAITING, null, { tasks: tests }),
      entry(BACKGROUND_SETTLED, null, { tasks: tests, ended: 'message' }),
    );

    expect(shown(builder)[0]).toMatchObject({
      status: 'completed',
      detail: 'A person sent a message.',
    });
  });

  it('marks a wait the agent did not live through as failed', () => {
    const builder = read(
      entry(BACKGROUND_WAITING, null, { tasks: tests }),
      entry(BACKGROUND_SETTLED, null, { tasks: tests, ended: 'gone' }),
    );

    expect(shown(builder)[0]).toMatchObject({
      status: 'failed',
      detail: 'The agent stopped.',
    });
  });

  it('reads what it can of a background payload of the wrong shape', () => {
    const builder = read(
      entry(BACKGROUND_WAITING, null, {
        tasks: [{ description: 7, kind: 'command' }, null, 'text'],
      }),
      entry(BACKGROUND_SETTLED, null, { tasks: 'none', ended: 'later' }),
      entry(BACKGROUND_LOST, null, { tasks: { id: 't1' } }),
    );

    expect(shown(builder)).toEqual([
      {
        kind: 'waited',
        text: 'command',
        status: 'completed',
        detail: null,
        input: null,
        output: null,
      },
    ]);
  });

  it('shows the background work that stopped with the run', () => {
    const builder = read(entry(BACKGROUND_LOST, null, { tasks: tests }));

    expect(shown(builder)).toEqual([
      {
        kind: 'lost',
        text: 'npx vitest run with the sandbox',
        status: 'failed',
        detail: null,
        input: null,
        output: null,
      },
    ]);
  });
});

describe('JournalBuilder, subagents', () => {
  const spawned = (state: Record<string, unknown>) =>
    event('child.changed', {
      child: 'child_1',
      title: 'Explore',
      description: 'Find the retry code',
      ...state,
    });

  it('groups what a subagent did under one step, with its brief and its answer', () => {
    const builder = read(
      said('Looking for the retry code.'),
      spawned({ state: 'running' }),
      event('child.message', {
        session: 'child_1',
        to: 'child_1',
        text: 'Find where uploads retry.',
      }),
      event('tool.changed', {
        session: 'child_1',
        id: 'call_1',
        title: 'grep retry',
        kind: 'search',
        status: 'completed',
      }),
      said('It is in uploads.ts.', 'child_1', 'm2'),
      spawned({ state: 'idle', stop: 'ended' }),
      event('child.message', {
        from: 'child_1',
        text: 'Retries live in uploads.ts.',
      }),
      said('Fixing it.', undefined, 'm3'),
    );

    expect(shown(builder)).toEqual([
      {
        kind: 'message',
        text: 'Looking for the retry code.',
        status: null,
        detail: null,
        input: null,
        output: null,
      },
      {
        kind: 'subagent',
        text: 'Explore',
        status: 'completed',
        detail: '- grep retry\nIt is in uploads.ts.',
        input: 'Find where uploads retry.',
        output: 'Retries live in uploads.ts.',
      },
      {
        kind: 'message',
        text: 'Fixing it.',
        status: null,
        detail: null,
        input: null,
        output: null,
      },
    ]);
  });

  it('keeps the work of a nested subagent inside the outer subagent', () => {
    const builder = read(
      spawned({ state: 'running' }),
      event('child.changed', {
        session: 'child_1',
        child: 'grandchild_1',
        title: 'Search',
        state: 'running',
      }),
      event('tool.changed', {
        session: 'grandchild_1',
        id: 'call_9',
        title: 'grep upload',
        kind: 'search',
        status: 'completed',
      }),
      said('Back in the parent.'),
    );

    expect(builder.steps().map((step) => step.kind)).toEqual([
      'subagent',
      'message',
    ]);
    expect(builder.calls()).toHaveLength(1);
  });

  it('keeps what the agent says before and after its subagent ends apart', () => {
    const builder = read(
      spawned({ state: 'running' }),
      said('I started the subagent.'),
      spawned({ state: 'idle', stop: 'ended' }),
      said('The subagent is done.'),
    );

    expect(
      builder
        .steps()
        .filter((step) => step.kind === 'message')
        .map((step) => step.text),
    ).toEqual(['I started the subagent.', 'The subagent is done.']);
  });

  it('counts the tool calls of a subagent with the run', () => {
    const builder = read(
      spawned({ state: 'running' }),
      event('tool.changed', {
        session: 'child_1',
        id: 'call_1',
        title: 'grep retry',
        kind: 'search',
        status: 'completed',
      }),
    );

    expect(builder.calls()).toHaveLength(1);
  });
});
