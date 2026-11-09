import {
  AGENT_REMINDED,
  BACKGROUND_LOST,
  BACKGROUND_SETTLED,
  BACKGROUND_WAITING,
  HARNESS_CONNECTED,
} from '@runs/domain/value-objects/journal-entry-type';
import { JournalBuilder } from '@runs/infrastructure/acp/journal-builder';
import type { Journalled } from '@runs/infrastructure/journal/journalled';
import { describe, expect, it } from 'vitest';

const encoded = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64');

const output = (
  update: Record<string, unknown>,
  sessionId = 'session_1',
): Omit<Journalled, 'at'> => ({
  type: 'output',
  message: null,
  data: encoded({ sessionId, update }),
});

const entry = (
  type: string,
  message: string | null,
  data: unknown = null,
): Omit<Journalled, 'at'> => ({
  type,
  message,
  data: data === null ? null : encoded(data),
});

const said = (text: string, sessionId?: string) =>
  output(
    { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
    sessionId,
  );

const clock = (at: number) => new Date(2026, 10, 9, 12, 0, at);

const read = (...entries: Omit<Journalled, 'at'>[]) => {
  const builder = new JournalBuilder();
  entries.forEach((each, at) => {
    builder.take({ ...each, at: clock(at) });
  });
  return builder;
};

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

describe('JournalBuilder, harness protocols', () => {
  it('reads the frames of an ACP v1 connection', () => {
    const builder = read(entry(HARNESS_CONNECTED, 'acp/1'), said('Done.'));

    expect(builder.steps().map((step) => step.text)).toEqual(['Done.']);
  });

  it('reads no frames of a protocol it does not know', () => {
    const builder = read(entry(HARNESS_CONNECTED, 'acp/9'), said('Done.'));

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
    output({
      sessionUpdate: 'subagent_update',
      sessionId: 'child_1',
      title: 'Explore',
      description: 'Find the retry code',
      state,
    });

  it('groups what a subagent did under one step, with its brief and its answer', () => {
    const builder = read(
      said('Looking for the retry code.'),
      spawned({ state: 'running' }),
      output(
        {
          sessionUpdate: 'session_message',
          senderSessionId: 'session_1',
          recipientSessionId: 'child_1',
          content: [{ type: 'text', text: 'Find where uploads retry.' }],
        },
        'child_1',
      ),
      output(
        {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_1',
          title: 'grep retry',
          kind: 'search',
          status: 'completed',
        },
        'child_1',
      ),
      said('It is in uploads.ts.', 'child_1'),
      spawned({ state: 'idle', stopReason: 'end_turn' }),
      output({
        sessionUpdate: 'session_message',
        senderSessionId: 'child_1',
        recipientSessionId: 'session_1',
        content: [{ type: 'text', text: 'Retries live in uploads.ts.' }],
      }),
      said('Fixing it.'),
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
      output(
        {
          sessionUpdate: 'subagent_update',
          sessionId: 'grandchild_1',
          title: 'Search',
          state: { state: 'running' },
        },
        'child_1',
      ),
      output(
        {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_9',
          title: 'grep upload',
          kind: 'search',
          status: 'completed',
        },
        'grandchild_1',
      ),
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
      spawned({ state: 'idle', stopReason: 'end_turn' }),
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
      output(
        {
          sessionUpdate: 'tool_call',
          toolCallId: 'call_1',
          title: 'grep retry',
          kind: 'search',
          status: 'completed',
        },
        'child_1',
      ),
    );

    expect(builder.calls()).toHaveLength(1);
  });
});
