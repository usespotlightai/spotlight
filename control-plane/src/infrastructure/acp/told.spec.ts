import { Money } from '@domain/value-objects/money.vo';
import { Told } from '@infrastructure/acp/told';
import { describe, expect, it } from 'vitest';

const sent = (update: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ sessionId: 'session_1', update })).toString(
    'base64',
  );

const chunk = (sessionUpdate: string, text: string) =>
  sent({ sessionUpdate, content: { type: 'text', text } });

const clock = (at: number) => new Date(2026, 7, 29, 12, 0, at);

// A second apart, so how long a step took is something a test can say.
const read = (...data: (string | null)[]) => {
  const told = new Told();
  data.forEach((each, at) => {
    told.take({ type: 'output', at: clock(at), message: null, data: each });
  });
  return told;
};

/** Nothing a tool reached for, which is most of what an agent does. */
const nowhere = { locations: [], given: null, returned: null, change: null };

const withoutTime = (told: Told) =>
  told.steps().map(({ ms, startedAt, ...step }) => step);

describe('Told', () => {
  // An agent speaks in fragments; what is worth reading is the whole thing.
  it('puts the chunks of one thing said back together', () => {
    const told = read(
      chunk('agent_message_chunk', 'Reproduced '),
      chunk('agent_message_chunk', 'on restart.'),
    );

    expect(withoutTime(told)).toEqual([
      {
        kind: 'said',
        text: 'Reproduced on restart.',
        status: null,
        tool: null,
        detail: null,
        ...nowhere,
      },
    ]);
  });

  it('keeps thinking apart from speaking', () => {
    const told = read(
      chunk('agent_thought_chunk', 'The queue looks stuck.'),
      chunk('agent_message_chunk', 'Draining it.'),
    );

    expect(told.steps().map((step) => step.kind)).toEqual(['thought', 'said']);
  });

  // How long it spoke for is the difference between thinking and stalling.
  it('says how long each thing took, and the run as a whole', () => {
    const told = read(
      chunk('agent_thought_chunk', 'Weighing it.'),
      chunk('agent_thought_chunk', ' Still weighing.'),
      chunk('agent_message_chunk', 'Done.'),
    );

    expect(told.steps()[0]?.ms).toBe(1_000);
    expect(told.ms()).toBe(2_000);
  });

  // A list of steps can be read; only one with a clock on it can be laid out.
  it('says when each step began', () => {
    const told = read(
      chunk('agent_thought_chunk', 'Weighing it.'),
      chunk('agent_message_chunk', 'Done.'),
    );

    expect(told.steps().map((step) => step.startedAt)).toEqual([
      clock(0),
      clock(1),
    ]);
  });

  it('has nothing to say about the length of a run that said nothing', () => {
    expect(new Told().ms()).toBeNull();
  });

  // A tool is announced pending and answered later, which is one thing done.
  it('folds a tool and how it went into one step', () => {
    const told = read(
      sent({
        sessionUpdate: 'tool_call',
        toolCallId: 'toolu_1',
        title: 'ToolSearch',
        kind: 'other',
        status: 'pending',
      }),
      sent({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'toolu_1',
        status: 'completed',
      }),
    );

    expect(withoutTime(told)).toEqual([
      {
        kind: 'tool',
        text: 'ToolSearch',
        status: 'completed',
        tool: 'other',
        detail: null,
        ...nowhere,
      },
    ]);
    expect(told.steps()[0]?.ms).toBe(1_000);
  });

  it('keeps two tools apart', () => {
    const told = read(
      sent({ sessionUpdate: 'tool_call', toolCallId: 'a', title: 'Read' }),
      sent({ sessionUpdate: 'tool_call', toolCallId: 'b', title: 'Write' }),
      sent({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'a',
        status: 'failed',
      }),
    );

    expect(
      told.steps().map(({ kind, text, status }) => ({ kind, text, status })),
    ).toEqual([
      { kind: 'tool', text: 'Read', status: 'failed' },
      { kind: 'tool', text: 'Write', status: null },
    ]);
  });

  // A command is announced as "Terminal" and only says what it was when it
  // answers, which is also where what it printed arrives.
  it('takes the command and its output from the answer', () => {
    const told = read(
      sent({
        sessionUpdate: 'tool_call',
        toolCallId: 'b1',
        title: 'Terminal',
        kind: 'execute',
        status: 'pending',
      }),
      sent({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'b1',
        title: 'ls -la /workspaces',
        kind: 'execute',
        status: 'completed',
        content: [
          { type: 'content', content: { type: 'text', text: 'total 0' } },
          { type: 'content', content: { type: 'text', text: 'drwxr-xr-x .' } },
        ],
      }),
    );

    expect(withoutTime(told)).toEqual([
      {
        kind: 'tool',
        text: 'ls -la /workspaces',
        status: 'completed',
        tool: 'execute',
        detail: 'total 0\ndrwxr-xr-x .',
        ...nowhere,
      },
    ]);
  });

  // A tool answers in markdown; what is wanted is what the fence holds.
  it('takes the answer out of the code fence it arrives in', () => {
    const told = read(
      sent({ sessionUpdate: 'tool_call', toolCallId: 'b3', title: 'Terminal' }),
      sent({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'b3',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: '```console\ntotal 0\n```' },
          },
        ],
      }),
    );

    expect(told.steps()[0]?.detail).toBe('total 0');
  });

  it('keeps only as much of an answer as anyone would read', () => {
    const told = read(
      sent({ sessionUpdate: 'tool_call', toolCallId: 'b2', title: 'Terminal' }),
      sent({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'b2',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: 'x'.repeat(9_000) },
          },
        ],
      }),
    );

    expect(told.steps()[0]?.detail).toHaveLength(4_000);
  });

  // Which file a step reached is the difference between reading a run and
  // being able to go to where it went.
  it('keeps where a tool reached, down to the line', () => {
    const told = read(
      sent({
        sessionUpdate: 'tool_call',
        toolCallId: 'r1',
        title: 'Read',
        kind: 'read',
        locations: [
          { path: '/workspace/app.module.ts', line: 126 },
          { path: '/workspace/main.ts' },
        ],
      }),
    );

    expect(told.steps()[0]?.locations).toEqual([
      { path: '/workspace/app.module.ts', line: 126 },
      { path: '/workspace/main.ts', line: null },
    ]);
  });

  it('keeps what a tool was asked for and what it handed back', () => {
    const told = read(
      sent({
        sessionUpdate: 'tool_call',
        toolCallId: 'g1',
        title: 'Grep',
        rawInput: { pattern: 'queue', path: 'src' },
      }),
      sent({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'g1',
        rawOutput: { matches: 3 },
      }),
    );

    const step = told.steps()[0];
    expect(step?.given).toBe('{\n  "pattern": "queue",\n  "path": "src"\n}');
    expect(step?.returned).toBe('{\n  "matches": 3\n}');
  });

  it('keeps a rewrite as what the file was and what it became', () => {
    const told = read(
      sent({ sessionUpdate: 'tool_call', toolCallId: 'e1', title: 'Edit' }),
      sent({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'e1',
        kind: 'edit',
        content: [
          {
            type: 'diff',
            path: '/workspace/queue.ts',
            oldText: 'const retries = 3;',
            newText: 'const retries = 500;',
          },
        ],
      }),
    );

    expect(told.steps()[0]?.change).toEqual({
      path: '/workspace/queue.ts',
      before: 'const retries = 3;',
      after: 'const retries = 500;',
    });
  });

  // A plan that keeps changing is worth seeing change, so each one is kept.
  it('reads what the agent said it meant to do', () => {
    const told = read(
      sent({
        sessionUpdate: 'plan',
        entries: [
          { content: 'Reproduce it', status: 'completed' },
          { content: 'Cap the retries', status: 'pending' },
        ],
      }),
    );

    const step = told.steps()[0];
    expect(step?.kind).toBe('planned');
    expect(step?.text).toBe('Planned 2 steps');
    expect(step?.detail).toBe(
      '[completed] Reproduce it\n[pending] Cap the retries',
    );
  });

  // Nothing else in the system has ever been able to say what a run cost.
  it('keeps what the run spent', () => {
    const told = read(
      sent({
        sessionUpdate: 'usage_update',
        used: 12_173,
        size: 200_000,
        cost: { amount: 0.0664917, currency: 'USD' },
      }),
    );

    expect(told.spent()).toEqual({
      used: 12_173,
      size: 200_000,
      cost: Money.of(0.0664917, 'USD'),
    });
    expect(told.steps()).toEqual([]);
  });

  it('passes over what it has nothing to show for', () => {
    const told = read(
      sent({ sessionUpdate: 'available_commands_update' }),
      sent({ sessionUpdate: 'session_info_update' }),
    );

    expect(told.steps()).toEqual([]);
    expect(told.readable).toBe(true);
  });

  // Runs from before the agents spoke a protocol left terminal bytes.
  it('says so when what it was given is not a protocol at all', () => {
    const bytes = `${String.fromCharCode(27)}[?25h`;
    const told = read(Buffer.from(bytes).toString('base64'));

    expect(told.readable).toBe(false);
    expect(told.steps()).toEqual([]);
  });

  describe('what happened around the agent', () => {
    // A hook is the deployment's code and prints plain text. Read as an
    // agent's update it is not a protocol at all, which used to condemn the
    // whole run as unreadable.
    it('keeps a hook as its own step without condemning the run', () => {
      const told = new Told(clock(0));
      told.take({
        type: 'output',
        at: clock(4),
        message: 'prepare',
        data: Buffer.from('Cloning into workspace…').toString('base64'),
      });
      told.take({
        type: 'output',
        at: clock(5),
        message: null,
        data: chunk('agent_message_chunk', 'Working.'),
      });

      const [hook, said] = told.steps();
      expect(hook?.kind).toBe('hook');
      expect(hook?.text).toBe('prepare');
      expect(hook?.detail).toBe('Cloning into workspace…');
      // It began when the run did: a hook is only written down once it ends.
      expect(hook?.ms).toBe(4_000);
      expect(said?.kind).toBe('said');
      expect(told.readable).toBe(true);
    });

    it('says where the run turned from preparing to working', () => {
      const told = new Told(clock(0));
      told.take({
        type: 'workspace.ready',
        at: clock(4),
        message: '/workspaces/run_1',
        data: null,
      });
      told.take({
        type: 'output',
        at: clock(6),
        message: null,
        data: chunk('agent_message_chunk', 'Working.'),
      });
      told.take({
        type: 'completed',
        at: clock(9),
        message: null,
        data: null,
      });

      expect(told.marks()).toEqual({
        startedAt: clock(0),
        readyAt: clock(4),
        spokeFrom: clock(6),
        spokeTo: clock(6),
        endedAt: clock(9),
      });
    });

    it('has no marks to give for a run that never started', () => {
      expect(new Told().marks()).toEqual({
        startedAt: null,
        readyAt: null,
        spokeFrom: null,
        spokeTo: null,
        endedAt: null,
      });
    });
  });
});
