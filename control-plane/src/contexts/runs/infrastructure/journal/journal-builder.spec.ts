import {
  AGENT_STOPPED,
  BACKGROUND_WAITING,
  HARNESS_CONNECTED,
} from '@runs/domain/value-objects/journal-entry-type';
import { Money } from '@runs/domain/value-objects/money.vo';
import { JournalBuilder } from '@runs/infrastructure/journal/journal-builder';
import type { Journalled } from '@runs/infrastructure/journal/journalled';
import { describe, expect, it } from 'vitest';

type Row = Omit<Journalled, 'at'>;

const encoded = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64');

const event = (type: string, data: Record<string, unknown>): Row => ({
  type,
  message: null,
  data: encoded(data),
});

const connected = (): Row =>
  event(HARNESS_CONNECTED, {
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

const said = (role: 'agent' | 'user' | 'thought', text: string, id = 'm1') =>
  event('message', { id, role, text });

const tool = (call: Record<string, unknown>) =>
  event('tool.changed', { title: 'a tool', ...call });

const printed = (id: string, text: string, replace = true) =>
  event('tool.output', { id, text, replace });

const clock = (at: number) => new Date(2026, 7, 29, 12, 0, at);

const listening = (began: Date | null = null) => {
  const builder = new JournalBuilder(began);
  builder.take({ ...connected(), at: began ?? clock(0) });
  return builder;
};

const read = (...rows: Row[]) => {
  const builder = listening();
  rows.forEach((each, at) => {
    builder.take({ ...each, at: clock(at) });
  });
  return builder;
};

const nowhere = { locations: [], input: null, output: null, change: null };

const withoutTime = (builder: JournalBuilder) =>
  builder.steps().map(({ ms: _ms, startedAt: _startedAt, ...step }) => step);

describe('JournalBuilder', () => {
  it('puts the chunks of one message back together', () => {
    const builder = read(
      said('agent', 'Reproduced '),
      said('agent', 'on restart.'),
    );

    expect(withoutTime(builder)).toEqual([
      {
        kind: 'message',
        text: 'Reproduced on restart.',
        status: null,
        tool: null,
        detail: null,
        ...nowhere,
      },
    ]);
  });

  it('takes a whole message in place of the chunks it had', () => {
    const builder = read(
      said('agent', 'Draft', 'm1'),
      event('message', {
        id: 'm1',
        role: 'agent',
        text: 'Reproduced on restart.',
        replace: true,
      }),
    );

    expect(builder.steps().map((step) => step.text)).toEqual([
      'Reproduced on restart.',
    ]);
  });

  it('marks a turn the agent started by itself', () => {
    const builder = read(
      event('turn.started', { turn: 1, origin: 'prompt' }),
      said('agent', 'Started the tests.', 'm1'),
      event('turn.started', { turn: 2, origin: 'self' }),
      said('agent', 'The tests pass.', 'm2'),
    );

    expect(builder.steps().map((step) => [step.kind, step.text])).toEqual([
      ['message', 'Started the tests.'],
      ['turn', ''],
      ['message', 'The tests pass.'],
    ]);
  });

  it('keeps what the session last did and the background work it last listed', () => {
    const builder = read(
      event('session.state', { state: 'running' }),
      event('background.changed', {
        items: [{ id: 't1', kind: 'command', description: 'npx vitest run' }],
      }),
      event('session.state', { state: 'needs-action' }),
    );

    expect(builder.activity()).toBe('needs-action');
    expect(builder.background()).toEqual([
      { id: 't1', kind: 'command', description: 'npx vitest run' },
    ]);
  });

  it('says the run waits for background work only while the runner waits for it', () => {
    const vitest = { id: 't1', kind: 'command', description: 'npx vitest run' };
    const idle = [
      event('session.state', { state: 'idle' }),
      event('background.changed', {
        items: [{ id: 't1', kind: 'command', description: 'npx vitest run' }],
      }),
    ];

    expect(read(...idle).activity()).toBe('working');
    expect(
      read(...idle, event(BACKGROUND_WAITING, { tasks: [vitest] })).activity(),
    ).toBe('waiting-for-background');
    expect(
      read(
        ...idle,
        event(BACKGROUND_WAITING, { tasks: [vitest] }),
        event(AGENT_STOPPED, {}),
      ).activity(),
    ).toBeNull();
  });

  it('starts a new message where the harness starts one', () => {
    const builder = read(
      said('agent', 'Reproduced it.', 'm1'),
      said('agent', 'Fixed it.', 'm2'),
    );

    expect(builder.steps().map((step) => step.text)).toEqual([
      'Reproduced it.',
      'Fixed it.',
    ]);
  });

  it('keeps thoughts apart from messages', () => {
    const builder = read(
      said('thought', 'The queue looks stuck.'),
      said('agent', 'Draining it.'),
    );

    expect(builder.steps().map((step) => step.kind)).toEqual([
      'thought',
      'message',
    ]);
  });

  it('says how long each thing took, and the run as a whole', () => {
    const builder = read(
      said('thought', 'Weighing it.', 'm1'),
      said('thought', ' Still weighing.', 'm1'),
      said('agent', 'Done.', 'm2'),
    );

    expect(builder.steps()[0]?.ms).toBe(1_000);
    expect(builder.ms()).toBe(2_000);
  });

  it('says when each step began', () => {
    const builder = read(
      said('thought', 'Weighing it.', 'm1'),
      said('agent', 'Done.', 'm2'),
    );

    expect(builder.steps().map((step) => step.startedAt)).toEqual([
      clock(0),
      clock(1),
    ]);
  });

  it('leaves the time the run waited for a person out of how long it took', () => {
    const builder = listening();
    builder.take({
      type: 'run.paused',
      at: clock(5),
      message: null,
      data: null,
    });
    for (const at of [0, 2, 60, 63]) {
      builder.take({ ...said('agent', 'Working.'), at: clock(at) });
    }

    expect(builder.ms()).toBe(5_000);
  });

  it('gives no length for a run that wrote nothing', () => {
    expect(new JournalBuilder().ms()).toBeNull();
  });

  it('folds a tool and how it went into one step', () => {
    const builder = read(
      tool({
        id: 'toolu_1',
        title: 'ToolSearch',
        kind: 'other',
        status: 'pending',
      }),
      tool({
        id: 'toolu_1',
        title: 'ToolSearch',
        kind: 'other',
        status: 'completed',
      }),
    );

    expect(withoutTime(builder)).toEqual([
      {
        kind: 'tool',
        text: 'ToolSearch',
        status: 'completed',
        tool: 'other',
        detail: null,
        ...nowhere,
      },
    ]);
    expect(builder.steps()[0]?.ms).toBe(1_000);
  });

  it('keeps two tools apart', () => {
    const builder = read(
      tool({ id: 'a', title: 'Read' }),
      tool({ id: 'b', title: 'Write' }),
      tool({ id: 'a', title: 'Read', status: 'failed' }),
    );

    expect(
      builder.steps().map(({ kind, text, status }) => ({ kind, text, status })),
    ).toEqual([
      { kind: 'tool', text: 'Read', status: 'failed' },
      { kind: 'tool', text: 'Write', status: null },
    ]);
  });

  it('takes the command and its output from the answer', () => {
    const builder = read(
      tool({ id: 'b1', title: 'Terminal', kind: 'execute', status: 'pending' }),
      tool({
        id: 'b1',
        title: 'ls -la /workspaces',
        kind: 'execute',
        status: 'completed',
      }),
      printed('b1', 'total 0\ndrwxr-xr-x .'),
    );

    expect(withoutTime(builder)).toEqual([
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

  it('adds what a command prints to what it printed before, until the harness gives all of it', () => {
    const builder = read(
      tool({ id: 'b4', title: 'npm test', kind: 'execute' }),
      printed('b4', 'PASS a.spec.ts\n', false),
      printed('b4', 'PASS b.spec.ts', false),
    );

    expect(builder.steps()[0]?.detail).toBe('PASS a.spec.ts\nPASS b.spec.ts');

    builder.take({ ...printed('b4', 'Tests: 2 passed'), at: clock(3) });

    expect(builder.steps()[0]?.detail).toBe('Tests: 2 passed');
  });

  it('takes the answer out of the code fence it arrives in', () => {
    const builder = read(
      tool({ id: 'b3', title: 'Terminal' }),
      printed('b3', '```console\ntotal 0\n```'),
    );

    expect(builder.steps()[0]?.detail).toBe('total 0');
  });

  it('keeps only as much of an answer as anyone would read', () => {
    const builder = read(
      tool({ id: 'b2', title: 'Terminal' }),
      printed('b2', 'x'.repeat(9_000)),
    );

    expect(builder.steps()[0]?.detail).toHaveLength(4_000);
  });

  it('keeps the locations a tool touched, down to the line', () => {
    const builder = read(
      tool({
        id: 'r1',
        title: 'Read',
        kind: 'read',
        locations: [
          { path: '/workspace/app.module.ts', line: 126 },
          { path: '/workspace/main.ts' },
        ],
      }),
    );

    expect(builder.steps()[0]?.locations).toEqual([
      { path: '/workspace/app.module.ts', line: 126 },
      { path: '/workspace/main.ts', line: null },
    ]);
  });

  it('keeps the input and the output of a tool', () => {
    const input = { pattern: 'queue', path: 'src' };
    const builder = read(
      tool({ id: 'g1', title: 'Grep', input }),
      tool({ id: 'g1', title: 'Grep', input, output: { matches: 3 } }),
    );

    const step = builder.steps()[0];
    expect(step?.input).toBe('{\n  "pattern": "queue",\n  "path": "src"\n}');
    expect(step?.output).toBe('{\n  "matches": 3\n}');
  });

  it('keeps a rewrite as what the file was and what it became', () => {
    const builder = read(
      tool({ id: 'e1', title: 'Edit' }),
      tool({
        id: 'e1',
        title: 'Edit',
        kind: 'edit',
        status: 'completed',
        files: [
          {
            path: '/workspace/queue.ts',
            operation: 'update',
            before: 'const retries = 3;',
            after: 'const retries = 500;',
          },
        ],
      }),
    );

    expect(builder.steps()[0]?.change).toEqual({
      path: '/workspace/queue.ts',
      before: 'const retries = 3;',
      after: 'const retries = 500;',
    });
  });

  it('keeps no change for an edit that did not go through', () => {
    const edit = {
      id: 'e1',
      title: 'Edit',
      kind: 'edit',
      files: [{ path: '/workspace/queue.ts', operation: 'update', after: 'x' }],
    };
    const builder = read(
      tool({ ...edit, status: 'pending' }),
      tool({ ...edit, status: 'failed' }),
    );

    expect(builder.steps()[0]?.change).toBeNull();
  });

  it('passes over an event that lacks what it must say', () => {
    const builder = read(
      event('plan.changed', {}),
      event('child.message', { from: 'child' }),
      tool({ id: 'a', locations: 'not a list' }),
      event('context.changed', { used: 'many', size: 1 }),
      said('agent', 'Still here.'),
    );

    expect(builder.steps().map((step) => step.text)).toEqual(['Still here.']);
    expect(builder.spent()).toBeNull();
  });

  it('reads what the agent said it meant to do', () => {
    const builder = read(
      event('plan.changed', {
        entries: [
          { content: 'Reproduce it', status: 'completed' },
          { content: 'Cap the retries', status: 'pending' },
        ],
      }),
    );

    const step = builder.steps()[0];
    expect(step?.kind).toBe('planned');
    expect(step?.text).toBe('Planned 2 steps');
    expect(step?.detail).toBe(
      '[completed] Reproduce it\n[pending] Cap the retries',
    );
  });

  it('keeps what the run spent', () => {
    const builder = read(
      event('context.changed', {
        used: 12_173,
        size: 200_000,
        cost: { amount: 0.0664917, currency: 'USD' },
      }),
    );

    expect(builder.spent()).toEqual({
      used: 12_173,
      size: 200_000,
      cost: Money.of(0.0664917, 'USD'),
    });
    expect(builder.spentBySession().get('session_1')).toEqual(builder.spent());
    expect(builder.steps()).toEqual([]);
  });

  it('keeps a cost it cannot read as unpriced', () => {
    const builder = read(
      event('context.changed', {
        used: 12_173,
        size: 200_000,
        cost: { amount: 3, currency: 'credits' },
      }),
    );

    expect(builder.spent()).toEqual({
      used: 12_173,
      size: 200_000,
      cost: null,
    });
  });

  it('adds up the tokens each turn reported, count by count', () => {
    const builder = read(
      event('turn.ended', {
        turn: 1,
        stop: 'ended',
        usage: { input: 3, output: 5, cacheRead: 100 },
      }),
      event('turn.ended', {
        turn: 2,
        stop: 'ended',
        usage: { input: 2, output: 1, cacheRead: 50 },
      }),
    );

    expect(builder.tokens()).toMatchObject({
      input: 5,
      output: 6,
      cacheRead: 150,
      cacheWrite: null,
    });
    expect(builder.steps()).toEqual([]);
  });

  it('keeps what the runner reported about egress, and nothing when it did not check', () => {
    const checked = (data: string | null) => {
      const builder = new JournalBuilder();
      builder.take({
        type: 'egress.checked',
        at: clock(1),
        message: null,
        data,
      });
      return builder.egressEnforcement();
    };

    expect(checked(encoded({ enforced: true }))).toBe('enforced');
    expect(checked(encoded({ enforced: false }))).toBe('not-enforced');
    expect(checked(encoded({ enforced: 'yes' }))).toBeNull();
    expect(checked(null)).toBeNull();
    expect(new JournalBuilder().egressEnforcement()).toBeNull();
  });

  it('knows no tokens where no turn reported any', () => {
    const builder = read(
      {
        type: 'turn.ended',
        message: null,
        data: Buffer.from('not usage').toString('base64'),
      },
      event('turn.ended', { turn: 1, stop: 'ended' }),
    );

    expect(builder.tokens()).toMatchObject({
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
    });
  });

  it('reads a count that is not a whole number of tokens as unreported', () => {
    const builder = read(
      event('turn.ended', {
        turn: 1,
        stop: 'ended',
        usage: { input: -1, output: 2.5, cacheRead: '7', cacheWrite: 4 },
      }),
    );

    expect(builder.tokens()).toMatchObject({
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: 4,
    });
  });

  it('passes over what it has nothing to show for', () => {
    const builder = read(
      event('turn.started', { turn: 1, origin: 'prompt' }),
      event('session.state', { state: 'running' }),
      event('background.changed', { items: [] }),
      said('user', 'Fix the queue.'),
      event('harness.frame', { protocol: 'acp/1', data: {} }),
    );

    expect(builder.steps()).toEqual([]);
  });

  describe('what happened around the agent', () => {
    it('keeps a hook as its own step', () => {
      const builder = listening(clock(0));
      builder.take({
        type: 'output',
        at: clock(4),
        message: 'prepare',
        data: Buffer.from('Cloning into workspace…').toString('base64'),
      });
      builder.take({ ...said('agent', 'Working.'), at: clock(5) });

      const [hook, message] = builder.steps();
      expect(hook?.kind).toBe('hook');
      expect(hook?.text).toBe('prepare');
      expect(hook?.detail).toBe('Cloning into workspace…');
      expect(hook?.ms).toBe(4_000);
      expect(message?.kind).toBe('message');
    });

    it('shows a pool failing to provision a runner as a failed hook step', () => {
      const builder = new JournalBuilder();
      builder.take({
        type: 'provision.failed',
        at: clock(2),
        message: null,
        data: encoded({
          failure: 'unreachable',
          detail: 'connect ECONNREFUSED 10.0.0.4:443',
        }),
      });

      const [failed] = builder.steps();
      expect(failed?.kind).toBe('hook');
      expect(failed?.status).toBe('failed');
      expect(failed?.text).toBe('Provisioning failed · unreachable');
      expect(failed?.detail).toBe('connect ECONNREFUSED 10.0.0.4:443');
    });

    it('keeps apart each failure to provision a runner', () => {
      const builder = new JournalBuilder();
      for (const at of [1, 2]) {
        builder.take({
          type: 'provision.failed',
          at: clock(at),
          message: null,
          data: null,
        });
      }

      expect(
        builder.steps().map((each) => [each.kind, each.status, each.detail]),
      ).toEqual([
        ['hook', 'failed', null],
        ['hook', 'failed', null],
      ]);
    });

    const hookCalled = (over: Record<string, unknown> = {}) =>
      encoded({
        hook: 'core/grafana-reads',
        step: 'notify',
        kind: 'call',
        target: 'slack.post-message',
        request: { channel: 'C1', text: 'Searched Grafana' },
        response: { ok: true },
        status: null,
        failed: false,
        startedAt: clock(3).toISOString(),
        ms: 250,
        ...over,
      });

    it('shows a hook calling out as a hook step with what it sent and got back', () => {
      const builder = new JournalBuilder(clock(0));
      builder.take({
        type: 'hook.called',
        at: clock(4),
        message: 'Hook core/grafana-reads · notify → slack.post-message',
        data: hookCalled(),
      });

      expect(builder.steps()).toEqual([
        {
          kind: 'hook',
          text: 'Hook core/grafana-reads · notify → slack.post-message',
          status: 'ok',
          tool: 'slack.post-message',
          detail: null,
          ms: 250,
          startedAt: clock(3),
          locations: [],
          input: JSON.stringify(
            { channel: 'C1', text: 'Searched Grafana' },
            null,
            2,
          ),
          output: JSON.stringify({ ok: true }, null, 2),
          change: null,
        },
      ]);
    });

    it('shows a hook call that failed as failed', () => {
      const builder = new JournalBuilder(clock(0));
      builder.take({
        type: 'hook.called',
        at: clock(4),
        message: null,
        data: hookCalled({
          failed: true,
          status: 502,
          response: 'Bad Gateway',
        }),
      });

      const [called] = builder.steps();
      expect(called?.status).toBe('failed');
      expect(called?.output).toBe('Bad Gateway');
    });

    it('puts a hook call where it happened among what the agent did', () => {
      const builder = listening(clock(0));
      builder.take({
        type: 'hook.called',
        at: clock(6),
        message: null,
        data: hookCalled({ startedAt: clock(5).toISOString() }),
      });
      builder.take({ ...said('thought', 'Looking.', 'm1'), at: clock(2) });
      builder.take({ ...said('agent', 'Found it.', 'm2'), at: clock(8) });

      expect(builder.steps().map((each) => each.kind)).toEqual([
        'thought',
        'hook',
        'message',
      ]);
      expect(builder.marks().endedAt).toEqual(clock(8));
    });

    it('passes over a hook call it cannot read', () => {
      const builder = new JournalBuilder(clock(0));
      builder.take({
        type: 'hook.called',
        at: clock(4),
        message: null,
        data: Buffer.from('not json').toString('base64'),
      });

      expect(builder.steps()).toEqual([]);
    });

    it('says where the run turned from preparing to working', () => {
      const builder = listening(clock(0));
      builder.take({
        type: 'working-copy.ready',
        at: clock(4),
        message: '/workspaces/run_1',
        data: null,
      });
      builder.take({ ...said('agent', 'Working.'), at: clock(6) });
      builder.take({
        type: 'completed',
        at: clock(9),
        message: null,
        data: null,
      });

      expect(builder.marks()).toEqual({
        startedAt: clock(0),
        readyAt: clock(4),
        firstAgentUpdateAt: clock(6),
        lastAgentUpdateAt: clock(6),
        agentStoppedAt: null,
        endedAt: clock(9),
      });
    });

    it('marks when the agent was stopped, without a step for it', () => {
      const builder = listening();
      builder.take({ ...said('agent', 'Working.'), at: clock(2) });
      builder.take({
        type: AGENT_STOPPED,
        at: clock(5),
        message: null,
        data: null,
      });

      expect(builder.marks().agentStoppedAt).toEqual(clock(5));
      expect(builder.steps().map((step) => step.text)).toEqual(['Working.']);
    });

    it('has no marks to give for a run that never started', () => {
      expect(new JournalBuilder().marks()).toEqual({
        startedAt: null,
        readyAt: null,
        firstAgentUpdateAt: null,
        lastAgentUpdateAt: null,
        agentStoppedAt: null,
        endedAt: null,
      });
    });
  });

  describe('calls', () => {
    it('names each call by the tool the harness says it called, with its server, time and ending', () => {
      const linear = {
        id: 'a',
        title: 'mcp__linear__get_issue',
        name: 'mcp__linear__get_issue',
        input: { id: 'ENG-1' },
      };
      const builder = read(
        tool(linear),
        tool({
          id: 'b',
          title: 'Read SKILL.md',
          kind: 'read',
          status: 'completed',
          name: 'Read',
          locations: [{ path: '/workspace/.claude/skills/grafana/SKILL.md' }],
        }),
        tool({ ...linear, status: 'failed' }),
        said('agent', 'Done.'),
      );

      expect(builder.calls()).toEqual([
        {
          server: 'linear',
          tool: 'get_issue',
          requestedSkill: null,
          paths: [],
          ms: 2_000,
          ending: 'failed',
        },
        {
          server: null,
          tool: 'Read',
          requestedSkill: null,
          paths: ['/workspace/.claude/skills/grafana/SKILL.md'],
          ms: 0,
          ending: 'completed',
        },
      ]);
    });

    it('names a call by its title where the harness gives no tool name', () => {
      const builder = read(
        tool({
          id: 'a',
          title: 'Tool: sentry/resolve_issue',
          status: 'completed',
        }),
      );

      expect(builder.calls()[0]).toMatchObject({
        server: 'sentry',
        tool: 'resolve_issue',
      });
    });

    it('times a call from when it started working, leaving out the wait for approval', () => {
      const builder = read(
        tool({ id: 'a', status: 'pending' }),
        tool({ id: 'a', status: 'in_progress' }),
        tool({ id: 'a', status: 'in_progress' }),
        tool({ id: 'a', status: 'completed' }),
      );

      expect(builder.calls()[0]?.ms).toBe(2_000);
    });

    it('leaves a call that never finished untimed', () => {
      const builder = read(tool({ id: 'a', status: 'pending' }));

      expect(builder.calls()[0]).toMatchObject({
        ms: null,
        ending: 'unfinished',
      });
    });

    it('takes a call as refused only when Spotlight refused its permission, whatever it said', () => {
      const comment = {
        title: 'mcp__linear__comment',
        name: 'mcp__linear__comment',
      };
      const builder = read(
        tool({ id: 'a', ...comment }),
        event('tool.refused', { toolCallId: 'a' }),
        tool({ id: 'a', ...comment, status: 'failed' }),
        tool({ id: 'b', ...comment }),
        tool({
          id: 'b',
          ...comment,
          status: 'failed',
          output: 'User refused permission to run tool',
        }),
      );

      expect(builder.calls().map((each) => each.ending)).toEqual([
        'refused',
        'failed',
      ]);
    });

    it('stops timing a call once it completed or failed', () => {
      const builder = read(
        tool({ id: 'a', status: 'in_progress' }),
        tool({ id: 'a', status: 'completed' }),
        said('agent', 'Reading it.'),
        tool({ id: 'a', status: 'completed', output: 'late output' }),
      );

      expect(builder.calls()[0]).toMatchObject({
        ms: 1_000,
        ending: 'completed',
      });
    });

    it('leaves the time the run waited for a person out of a call that never said it was working', () => {
      const builder = listening();
      const call = (at: number, status: string) =>
        builder.take({ ...tool({ id: 'a', status }), at: clock(at) });

      call(0, 'pending');
      call(2, 'pending');
      builder.take({
        type: 'run.paused',
        at: clock(3),
        message: null,
        data: null,
      });
      call(60, 'pending');
      call(61, 'completed');

      expect(builder.calls()[0]?.ms).toBe(3_000);
    });

    it('takes a call announced twice under one id as one call', () => {
      const builder = read(
        tool({ id: 'a', status: 'pending', name: 'mcp__linear__get_issue' }),
        tool({ id: 'a', status: 'in_progress' }),
        tool({ id: 'a', status: 'completed' }),
      );

      expect(builder.calls()).toEqual([
        expect.objectContaining({
          server: 'linear',
          tool: 'get_issue',
          ms: 1_000,
          ending: 'completed',
        }),
      ]);
      expect(builder.steps()).toHaveLength(1);
    });

    it('never reads a server out of the title of a command', () => {
      const builder = read(
        tool({
          id: 'a',
          kind: 'execute',
          title: 'mcp__linear__get_issue',
          status: 'completed',
        }),
      );

      expect(builder.calls()[0]).toMatchObject({
        server: null,
        tool: 'mcp__linear__get_issue',
      });
    });

    it('reads the skill that the harness’s skill tool requested', () => {
      const builder = read(
        tool({
          id: 'a',
          title: 'Skill',
          status: 'completed',
          name: 'Skill',
          input: { skill: 'our-migrations' },
        }),
      );

      expect(builder.calls()[0]?.requestedSkill).toBe('our-migrations');
    });

    it('offers only the paths of a read, search or command as read', () => {
      const builder = read(
        tool({
          id: 'a',
          kind: 'execute',
          status: 'completed',
          name: 'Bash',
          input: { command: 'cat .claude/skills/grafana/SKILL.md' },
        }),
        tool({
          id: 'b',
          kind: 'edit',
          status: 'completed',
          name: 'Write',
          locations: [{ path: '/workspace/.claude/skills/grafana/SKILL.md' }],
          input: { file_path: '/workspace/.claude/skills/grafana/SKILL.md' },
        }),
        tool({
          id: 'c',
          kind: 'other',
          status: 'completed',
          name: 'mcp__wiki__save',
          input: { path: '.claude/skills/grafana/SKILL.md' },
        }),
      );

      expect(builder.calls().map((each) => each.paths)).toEqual([
        [
          JSON.stringify(
            { command: 'cat .claude/skills/grafana/SKILL.md' },
            null,
            2,
          ),
        ],
        [],
        [],
      ]);
    });

    it('keeps the tool’s name and working time out of the steps it shows', () => {
      const builder = read(
        tool({
          id: 'a',
          title: 'Search',
          status: 'in_progress',
          name: 'mcp__wiki__search',
        }),
      );

      expect(builder.steps()[0]).not.toHaveProperty('named');
      expect(builder.steps()[0]).not.toHaveProperty('workingAt');
    });
  });
});
