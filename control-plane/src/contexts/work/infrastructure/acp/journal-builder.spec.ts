import { AGENT_STOPPED } from '@work/application/contracts/run-journal.contract';
import { Money } from '@work/domain/value-objects/money.vo';
import { JournalBuilder } from '@work/infrastructure/acp/journal-builder';
import { describe, expect, it } from 'vitest';

const sent = (update: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ sessionId: 'session_1', update })).toString(
    'base64',
  );

const chunk = (sessionUpdate: string, text: string) =>
  sent({ sessionUpdate, content: { type: 'text', text } });

const clock = (at: number) => new Date(2026, 7, 29, 12, 0, at);

const read = (...data: (string | null)[]) => {
  const builder = new JournalBuilder();
  data.forEach((each, at) => {
    builder.take({ type: 'output', at: clock(at), message: null, data: each });
  });
  return builder;
};

const nowhere = { locations: [], input: null, output: null, change: null };

const withoutTime = (builder: JournalBuilder) =>
  builder.steps().map(({ ms, startedAt, ...step }) => step);

describe('JournalBuilder', () => {
  it('puts the chunks of one message back together', () => {
    const builder = read(
      chunk('agent_message_chunk', 'Reproduced '),
      chunk('agent_message_chunk', 'on restart.'),
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

  it('keeps thoughts apart from messages', () => {
    const builder = read(
      chunk('agent_thought_chunk', 'The queue looks stuck.'),
      chunk('agent_message_chunk', 'Draining it.'),
    );

    expect(builder.steps().map((step) => step.kind)).toEqual([
      'thought',
      'message',
    ]);
  });

  it('says how long each thing took, and the run as a whole', () => {
    const builder = read(
      chunk('agent_thought_chunk', 'Weighing it.'),
      chunk('agent_thought_chunk', ' Still weighing.'),
      chunk('agent_message_chunk', 'Done.'),
    );

    expect(builder.steps()[0]?.ms).toBe(1_000);
    expect(builder.ms()).toBe(2_000);
  });

  it('says when each step began', () => {
    const builder = read(
      chunk('agent_thought_chunk', 'Weighing it.'),
      chunk('agent_message_chunk', 'Done.'),
    );

    expect(builder.steps().map((step) => step.startedAt)).toEqual([
      clock(0),
      clock(1),
    ]);
  });

  it('leaves the time the run waited for a person out of how long it took', () => {
    const builder = new JournalBuilder();
    builder.take({
      type: 'run.paused',
      at: clock(5),
      message: null,
      data: null,
    });
    for (const at of [0, 2, 60, 63]) {
      builder.take({
        type: 'output',
        at: clock(at),
        message: null,
        data: chunk('agent_message_chunk', 'Working.'),
      });
    }

    expect(builder.ms()).toBe(5_000);
  });

  it('gives no length for a run that wrote nothing', () => {
    expect(new JournalBuilder().ms()).toBeNull();
  });

  it('folds a tool and how it went into one step', () => {
    const builder = read(
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
      sent({ sessionUpdate: 'tool_call', toolCallId: 'a', title: 'Read' }),
      sent({ sessionUpdate: 'tool_call', toolCallId: 'b', title: 'Write' }),
      sent({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'a',
        status: 'failed',
      }),
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

  it('takes the answer out of the code fence it arrives in', () => {
    const builder = read(
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

    expect(builder.steps()[0]?.detail).toBe('total 0');
  });

  it('keeps only as much of an answer as anyone would read', () => {
    const builder = read(
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

    expect(builder.steps()[0]?.detail).toHaveLength(4_000);
  });

  it('keeps the locations a tool touched, down to the line', () => {
    const builder = read(
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

    expect(builder.steps()[0]?.locations).toEqual([
      { path: '/workspace/app.module.ts', line: 126 },
      { path: '/workspace/main.ts', line: null },
    ]);
  });

  it('keeps the input and the output of a tool', () => {
    const builder = read(
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

    const step = builder.steps()[0];
    expect(step?.input).toBe('{\n  "pattern": "queue",\n  "path": "src"\n}');
    expect(step?.output).toBe('{\n  "matches": 3\n}');
  });

  it('keeps a rewrite as what the file was and what it became', () => {
    const builder = read(
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

    expect(builder.steps()[0]?.change).toEqual({
      path: '/workspace/queue.ts',
      before: 'const retries = 3;',
      after: 'const retries = 500;',
    });
  });

  it('reads what the agent said it meant to do', () => {
    const builder = read(
      sent({
        sessionUpdate: 'plan',
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
      sent({
        sessionUpdate: 'usage_update',
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
    expect(builder.steps()).toEqual([]);
  });

  it('adds up the tokens each turn reported, count by count', () => {
    const builder = new JournalBuilder();
    const turn = (usage: Record<string, unknown>, at: number) =>
      builder.take({
        type: 'usage',
        at: clock(at),
        message: null,
        data: Buffer.from(JSON.stringify(usage)).toString('base64'),
      });

    turn({ inputTokens: 3, outputTokens: 5, cachedReadTokens: 100 }, 1);
    turn({ inputTokens: 2, outputTokens: 1, cachedReadTokens: 50 }, 2);

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
    const encoded = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString('base64');

    expect(checked(encoded({ enforced: true }))).toBe('enforced');
    expect(checked(encoded({ enforced: false }))).toBe('not-enforced');
    expect(checked(encoded({ enforced: 'yes' }))).toBeNull();
    expect(checked(null)).toBeNull();
    expect(new JournalBuilder().egressEnforcement()).toBeNull();
  });

  it('knows no tokens where no turn reported any', () => {
    const builder = new JournalBuilder();
    builder.take({
      type: 'usage',
      at: clock(1),
      message: null,
      data: Buffer.from('not usage').toString('base64'),
    });

    expect(builder.tokens()).toMatchObject({
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: null,
    });
  });

  it('reads a count that is not a whole number of tokens as unreported', () => {
    const builder = new JournalBuilder();
    builder.take({
      type: 'usage',
      at: clock(1),
      message: null,
      data: Buffer.from(
        JSON.stringify({
          inputTokens: -1,
          outputTokens: 2.5,
          cachedReadTokens: '7',
          cachedWriteTokens: 4,
        }),
      ).toString('base64'),
    });

    expect(builder.tokens()).toMatchObject({
      input: null,
      output: null,
      cacheRead: null,
      cacheWrite: 4,
    });
  });

  it('passes over what it has nothing to show for', () => {
    const builder = read(
      sent({ sessionUpdate: 'available_commands_update' }),
      sent({ sessionUpdate: 'session_info_update' }),
    );

    expect(builder.steps()).toEqual([]);
  });

  describe('what happened around the agent', () => {
    it('keeps a hook as its own step', () => {
      const builder = new JournalBuilder(clock(0));
      builder.take({
        type: 'output',
        at: clock(4),
        message: 'prepare',
        data: Buffer.from('Cloning into workspace…').toString('base64'),
      });
      builder.take({
        type: 'output',
        at: clock(5),
        message: null,
        data: chunk('agent_message_chunk', 'Working.'),
      });

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
        message: 'Provisioning failed · unreachable',
        data: Buffer.from('connect ECONNREFUSED 10.0.0.4:443').toString(
          'base64',
        ),
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
          message: 'Provisioning failed · http-error',
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
      Buffer.from(
        JSON.stringify({
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
        }),
      ).toString('base64');

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
      const builder = new JournalBuilder(clock(0));
      builder.take({
        type: 'hook.called',
        at: clock(6),
        message: null,
        data: hookCalled({ startedAt: clock(5).toISOString() }),
      });
      builder.take({
        type: 'output',
        at: clock(2),
        message: null,
        data: chunk('agent_thought_chunk', 'Looking.'),
      });
      builder.take({
        type: 'output',
        at: clock(8),
        message: null,
        data: chunk('agent_message_chunk', 'Found it.'),
      });

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
      const builder = new JournalBuilder(clock(0));
      builder.take({
        type: 'workspace.ready',
        at: clock(4),
        message: '/workspaces/run_1',
        data: null,
      });
      builder.take({
        type: 'output',
        at: clock(6),
        message: null,
        data: chunk('agent_message_chunk', 'Working.'),
      });
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
      const builder = new JournalBuilder();
      builder.take({
        type: 'output',
        at: clock(2),
        message: null,
        data: chunk('agent_message_chunk', 'Working.'),
      });
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
      const builder = read(
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          title: 'mcp__linear__get_issue',
          _meta: { claudeCode: { toolName: 'mcp__linear__get_issue' } },
          rawInput: { id: 'ENG-1' },
        }),
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'b',
          title: 'Read SKILL.md',
          kind: 'read',
          status: 'completed',
          _meta: { claudeCode: { toolName: 'Read' } },
          locations: [{ path: '/workspace/.claude/skills/grafana/SKILL.md' }],
        }),
        sent({
          sessionUpdate: 'tool_call_update',
          toolCallId: 'a',
          status: 'failed',
        }),
        chunk('agent_message_chunk', 'Done.'),
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

    it('takes the bridge’s own file tools for the harness’s, while a server of the same name still counts', () => {
      const builder = read(
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          title: 'Read',
          status: 'completed',
          _meta: { claudeCode: { toolName: 'mcp__acp__Read' } },
        }),
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'b',
          title: 'mcp__acp__query',
          status: 'completed',
          _meta: { claudeCode: { toolName: 'mcp__acp__query' } },
        }),
      );

      expect(
        builder.calls().map(({ server, tool }) => ({ server, tool })),
      ).toEqual([
        { server: null, tool: 'Read' },
        { server: 'acp', tool: 'query' },
      ]);
    });

    it('names a call by its title where the harness gives no tool name', () => {
      const builder = read(
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
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
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          status: 'pending',
        }),
        sent({
          sessionUpdate: 'tool_call_update',
          toolCallId: 'a',
          status: 'in_progress',
        }),
        sent({
          sessionUpdate: 'tool_call_update',
          toolCallId: 'a',
          status: 'in_progress',
        }),
        sent({
          sessionUpdate: 'tool_call_update',
          toolCallId: 'a',
          status: 'completed',
        }),
      );

      expect(builder.calls()[0]?.ms).toBe(2_000);
    });

    it('leaves a call that never finished untimed', () => {
      const builder = read(
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          status: 'pending',
        }),
      );

      expect(builder.calls()[0]).toMatchObject({
        ms: null,
        ending: 'unfinished',
      });
    });

    it('takes a call as refused only when Spotlight refused its permission, whatever it said', () => {
      const builder = new JournalBuilder();
      const journal = [
        {
          type: 'output',
          data: sent({
            sessionUpdate: 'tool_call',
            toolCallId: 'a',
            _meta: { claudeCode: { toolName: 'mcp__linear__comment' } },
          }),
        },
        {
          type: 'tool.refused',
          data: Buffer.from(JSON.stringify({ toolCallId: 'a' })).toString(
            'base64',
          ),
        },
        {
          type: 'output',
          data: sent({
            sessionUpdate: 'tool_call_update',
            toolCallId: 'a',
            status: 'failed',
          }),
        },
        {
          type: 'output',
          data: sent({
            sessionUpdate: 'tool_call',
            toolCallId: 'b',
            _meta: { claudeCode: { toolName: 'mcp__linear__comment' } },
          }),
        },
        {
          type: 'output',
          data: sent({
            sessionUpdate: 'tool_call_update',
            toolCallId: 'b',
            status: 'failed',
            rawOutput: 'User refused permission to run tool',
          }),
        },
      ];
      journal.forEach((each, at) => {
        builder.take({ ...each, at: clock(at), message: null });
      });

      expect(builder.calls().map((each) => each.ending)).toEqual([
        'refused',
        'failed',
      ]);
    });

    it('stops timing a call once it completed or failed', () => {
      const builder = read(
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          status: 'in_progress',
        }),
        sent({
          sessionUpdate: 'tool_call_update',
          toolCallId: 'a',
          status: 'completed',
        }),
        chunk('agent_message_chunk', 'Reading it.'),
        sent({
          sessionUpdate: 'tool_call_update',
          toolCallId: 'a',
          rawOutput: 'late output',
        }),
      );

      expect(builder.calls()[0]).toMatchObject({
        ms: 1_000,
        ending: 'completed',
      });
    });

    it('leaves the time the run waited for a person out of a call that never said it was working', () => {
      const builder = new JournalBuilder();
      const call = (at: number, update: Record<string, unknown>) =>
        builder.take({
          type: 'output',
          at: clock(at),
          message: null,
          data: sent({ toolCallId: 'a', ...update }),
        });

      call(0, { sessionUpdate: 'tool_call', status: 'pending' });
      call(2, { sessionUpdate: 'tool_call_update' });
      builder.take({
        type: 'run.paused',
        at: clock(3),
        message: null,
        data: null,
      });
      call(60, { sessionUpdate: 'tool_call_update' });
      call(61, { sessionUpdate: 'tool_call_update', status: 'completed' });

      expect(builder.calls()[0]?.ms).toBe(3_000);
    });

    it('takes a call announced twice under one id as one call', () => {
      const builder = read(
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          status: 'pending',
          _meta: { claudeCode: { toolName: 'mcp__linear__get_issue' } },
        }),
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          status: 'in_progress',
        }),
        sent({
          sessionUpdate: 'tool_call_update',
          toolCallId: 'a',
          status: 'completed',
        }),
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
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
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
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          title: 'Skill',
          status: 'completed',
          _meta: { claudeCode: { toolName: 'Skill' } },
          rawInput: { skill: 'our-migrations' },
        }),
      );

      expect(builder.calls()[0]?.requestedSkill).toBe('our-migrations');
    });

    it('offers only the paths of a read, search or command as read', () => {
      const builder = read(
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          kind: 'execute',
          status: 'completed',
          _meta: { claudeCode: { toolName: 'Bash' } },
          rawInput: { command: 'cat .claude/skills/grafana/SKILL.md' },
        }),
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'b',
          kind: 'edit',
          status: 'completed',
          _meta: { claudeCode: { toolName: 'Write' } },
          locations: [{ path: '/workspace/.claude/skills/grafana/SKILL.md' }],
          rawInput: { file_path: '/workspace/.claude/skills/grafana/SKILL.md' },
        }),
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'c',
          kind: 'other',
          status: 'completed',
          _meta: { claudeCode: { toolName: 'mcp__wiki__save' } },
          rawInput: { path: '.claude/skills/grafana/SKILL.md' },
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
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'a',
          title: 'Search',
          status: 'in_progress',
          _meta: { claudeCode: { toolName: 'mcp__wiki__search' } },
        }),
      );

      expect(builder.steps()[0]).not.toHaveProperty('named');
      expect(builder.steps()[0]).not.toHaveProperty('workingAt');
    });
  });
});
