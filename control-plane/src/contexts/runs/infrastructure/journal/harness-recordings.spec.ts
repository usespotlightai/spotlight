import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ChangedPaths } from '@runs/infrastructure/journal/changed-paths';
import { JournalBuilder } from '@runs/infrastructure/journal/journal-builder';
import type { Journalled } from '@runs/infrastructure/journal/journalled';
import { describe, expect, it } from 'vitest';

const RECORDINGS = join(
  __dirname,
  '../../../../../../data-plane/runner/internal/acp/testdata',
);

const encoded = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64');

const clock = (at: number) => new Date(2026, 10, 14, 12, 0, at);

const REPORTS = {
  'acp-1': {
    background: false,
    selfStartedTurns: false,
    turnUsage: true,
    commandOutput: false,
  },
  'acp-2': {
    background: true,
    selfStartedTurns: true,
    turnUsage: true,
    commandOutput: true,
  },
};

const recorded = (
  scenario: string,
  version: keyof typeof REPORTS = 'acp-1',
): Journalled[] => [
  {
    type: 'harness.connected',
    at: clock(0),
    message: null,
    data: encoded({
      protocol: version.replace('-', '/'),
      events: 1,
      session: 'session_1',
      reports: REPORTS[version],
    }),
  },
  ...readFileSync(
    join(RECORDINGS, 'claude-code', version, `${scenario}.events.jsonl`),
    'utf8',
  )
    .split('\n')
    .filter(Boolean)
    .map((line, at) => {
      const { type, data } = JSON.parse(line) as {
        type: string;
        data: unknown;
      };
      return { type, at: clock(at + 1), message: null, data: encoded(data) };
    }),
];

const built = (
  scenario: string,
  version: keyof typeof REPORTS = 'acp-1',
): JournalBuilder => {
  const builder = new JournalBuilder();
  for (const event of recorded(scenario, version)) {
    builder.take(event);
  }
  return builder;
};

const stepsOf = (scenario: string, version: keyof typeof REPORTS = 'acp-1') =>
  built(scenario, version)
    .steps()
    .map(({ ms: _ms, startedAt: _startedAt, ...step }) => step);

const nowhere = { locations: [], input: null, output: null, change: null };

describe('the recordings of Claude Code over ACP v1', () => {
  it('reads a message and a thought, and what the turn used', () => {
    const builder = built('text');

    expect(stepsOf('text')).toEqual([
      {
        kind: 'thought',
        text: 'The queue looks stuck.',
        status: null,
        tool: null,
        detail: null,
        ...nowhere,
      },
      {
        kind: 'message',
        text: 'Reproduced on restart.',
        status: null,
        tool: null,
        detail: null,
        ...nowhere,
      },
    ]);
    expect(builder.tokens()).toMatchObject({
      input: 120,
      output: 40,
      cacheRead: 900,
      cacheWrite: null,
    });
  });

  it('reads a command with what it printed', () => {
    expect(stepsOf('command')).toEqual([
      {
        kind: 'tool',
        text: '`npm test`',
        status: 'completed',
        tool: 'execute',
        detail: '12 passed',
        locations: [],
        input: JSON.stringify(
          { command: 'npm test', description: 'Run the tests' },
          null,
          2,
        ),
        output: JSON.stringify({ stdout: '12 passed', exitCode: 0 }, null, 2),
        change: null,
      },
    ]);
    expect(built('command').calls()).toMatchObject([
      { server: null, tool: 'Bash', ending: 'completed' },
    ]);
  });

  it('reads the files that edits changed', () => {
    const paths = new ChangedPaths();
    for (const event of recorded('edit')) {
      paths.take({ ...event, attempt: 1 });
    }

    expect(paths.paths()).toEqual(['/work/src/queue.ts', '/work/NOTES.md']);
    expect(stepsOf('edit')[0]?.change).toEqual({
      path: '/work/src/queue.ts',
      before: 'drain()',
      after: 'drain(true)',
    });
  });

  it('reads a plan and how full the context is', () => {
    expect(stepsOf('plan')).toEqual([
      {
        kind: 'planned',
        text: 'Planned 2 steps',
        status: null,
        tool: null,
        detail:
          '[completed] Reproduce the stuck queue\n[in_progress] Drain it on restart',
        ...nowhere,
      },
    ]);
    expect(built('plan').spent()).toMatchObject({
      used: 53_000,
      size: 200_000,
    });
  });

  it('reads a subagent with what it was asked and what it answered', () => {
    expect(stepsOf('subagent')).toEqual([
      expect.objectContaining({
        kind: 'tool',
        text: 'Task',
        status: 'completed',
      }),
      {
        kind: 'subagent',
        text: 'Find the flaky test',
        status: 'completed',
        tool: null,
        detail: 'It is queue.spec.ts.',
        locations: [],
        input: 'Find the flaky test in src/queue.',
        output: 'queue.spec.ts is flaky.',
        change: null,
      },
    ]);
  });

  it('reads a turn that started background work as the message it wrote', () => {
    expect(stepsOf('background').map((step) => step.text)).toEqual([
      'Started the tests.',
    ]);
  });

  it('reads a refused turn as the message it wrote', () => {
    expect(stepsOf('refused').map((step) => step.text)).toEqual([
      "I can't help with that.",
    ]);
  });
});

describe('the recordings of Claude Code over ACP v2', () => {
  it('reads a command with what its terminal printed', () => {
    const command = stepsOf('command', 'acp-2').find(
      (step) => step.kind === 'tool',
    );

    expect(command).toMatchObject({
      text: 'echo hi',
      status: 'completed',
      tool: 'execute',
      detail: 'hi',
    });
    expect(built('command', 'acp-2').calls()).toMatchObject([
      { server: null, tool: 'Bash', ending: 'completed' },
    ]);
  });

  it('reads the files that edits changed', () => {
    const paths = new ChangedPaths();
    for (const event of recorded('edit', 'acp-2')) {
      paths.take({ ...event, attempt: 1 });
    }

    expect(paths.paths()).toEqual(['/work/notes.md', '/work/notes.md']);
  });

  it('reads what each edit changed from its patch', () => {
    const changes = built('edit', 'acp-2')
      .steps()
      .flatMap((step) => (step.change ? [step.change] : []));

    expect(changes).toEqual([
      { path: '/work/notes.md', before: '', after: 'one' },
      { path: '/work/notes.md', before: 'one', after: 'two' },
    ]);
  });

  it('reads what the turn used', () => {
    const { input, output } = built('text', 'acp-2').tokens();

    expect(input).toBeGreaterThan(0);
    expect(output).toBeGreaterThan(0);
  });

  it('reads the turn the agent started itself when its background work ended', () => {
    const messages = stepsOf('background', 'acp-2').filter(
      (step) => step.kind === 'message',
    );

    expect(messages[messages.length - 1]?.text).toBe('finished');
  });

  it('reads a background subagent as a subagent step', () => {
    expect(stepsOf('subagent', 'acp-2')).toContainEqual(
      expect.objectContaining({ kind: 'subagent', status: 'completed' }),
    );
  });
});
