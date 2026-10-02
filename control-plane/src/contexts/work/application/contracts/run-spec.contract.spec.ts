import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import { InvalidRunSpecError } from '@work/domain/exceptions/invalid-run-spec.error';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { describe, expect, it } from 'vitest';

const command = { executable: 'claude-agent-acp', args: [] };

const parts = (over: Record<string, unknown> = {}) => ({
  command,
  briefing: 'do the thing',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  continuity: { key: 'task-task_1' },
  ...over,
});

const representative = {
  checkouts: [
    {
      remote: 'spotlight:repository',
      path: 'widgets',
      branch: 'spotlight/task_1',
    },
    { remote: 'spotlight:repository', path: 'gadgets' },
  ],
  command: {
    executable: 'claude-agent-acp',
    args: ['--acp'],
    env: { TRACEPARENT: '00-abc-def-01' },
  },
  briefing: 'do the thing',
  handover: { options: ['spec', 'review'], noteLimit: 4_000 },
  continuity: { key: 'task-task_1', sessionId: 'session_1' },
  skills: [{ path: '.claude/skills/triage/SKILL.md', text: '# Triage' }],
  skillHomes: ['.claude/skills', '.spotlight/skills'],
  manifest: [
    {
      name: 'grafana.search',
      description: 'Search dashboards',
      inputs: [
        {
          name: 'query',
          type: 'string',
          description: 'What to look for',
          required: true,
          defaulted: false,
          piped: false,
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          defaulted: true,
          piped: false,
        },
      ],
    },
  ],
  attachments: [
    { id: 'att_1', path: '.spotlight/attachments/att_1/screen.png' },
  ],
  settingFiles: ['claude/settings.json'],
  wears: ['LINEAR_API_KEY'],
};

describe('RunSpecContract wire', () => {
  it('round-trips a spec to the same JSON the runner and the store read', () => {
    const stored = JSON.parse(JSON.stringify(representative));
    const spec = RunSpecContract.from(stored);

    expect(JSON.stringify(RunSpecContract.toWire(spec))).toBe(
      JSON.stringify(representative),
    );
  });

  it('round-trips a search to an empty search block, and refuses one that is no object', () => {
    const searching = parts({
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'search-run_1' },
      search: {},
    });

    expect(RunSpecContract.toWire(RunSpecContract.from(searching))).toEqual(
      searching,
    );
    expect(() => RunSpecContract.from(parts({ search: true }))).toThrow(
      InconsistentStateError,
    );
  });

  it('keeps no empty list of secrets worn', () => {
    expect(
      RunSpecContract.from(parts({ wears: [] })).value.wears,
    ).toBeUndefined();
  });

  it('reads the smallest spec a runner can be handed', () => {
    expect(RunSpecContract.from(parts()).value).toEqual(parts());
  });

  it('refuses what is not a spec as a stored run that no longer reads', () => {
    for (const raw of [
      null,
      undefined,
      'a spec',
      7,
      [],
      { briefing: 'do the thing' },
      parts({ handover: { noteLimit: 10 } }),
      parts({
        manifest: [{ name: 'x', description: 'x', inputs: [{ type: 'date' }] }],
      }),
      parts({ briefing: '  ' }),
    ]) {
      expect(() => RunSpecContract.from(raw)).toThrow(InconsistentStateError);
    }
  });
});

describe('RunSpecContract.ordered', () => {
  it('runs what Spotlight says, not what the caller asked for', () => {
    const spec = RunSpecContract.ordered(
      {
        briefing: 'do the thing',
        command: { executable: 'rm', args: ['-rf'] },
      },
      command,
    );

    expect(spec.value.command).toEqual(command);
  });

  it('fills in what a caller left out', () => {
    const spec = RunSpecContract.ordered({ briefing: 'do the thing' }, command);

    expect(spec.value.handover).toEqual({ options: [], noteLimit: 0 });
    expect(spec.value.continuity).toEqual({ key: '' });
  });

  it('refuses what is not a spec at all', () => {
    for (const raw of [null, undefined, 'a spec', 7]) {
      expect(() => RunSpecContract.ordered(raw, command)).toThrow(
        InvalidRunSpecError,
      );
    }
  });

  it('holds a caller to the same rules as Spotlight', () => {
    expect(() =>
      RunSpecContract.ordered(
        { briefing: 'do it', checkouts: [{ remote: 'x', path: '../out' }] },
        command,
      ),
    ).toThrow(InvalidRunSpecError);
  });
});

describe('RunSpecContract.continuityOf', () => {
  const key = ContinuityKey.of('task-task_2');

  it('tells the runner which directory to work in', () => {
    expect(RunSpecContract.continuityOf(Continuity.of({ key }))).toEqual({
      key: 'task-task_2',
    });
  });

  it('names the conversation to take up where there is one', () => {
    expect(
      RunSpecContract.continuityOf(
        Continuity.of({
          key,
          sessionId: HarnessSession.of('session_1'),
        }),
      ),
    ).toEqual({
      key: 'task-task_2',
      sessionId: 'session_1',
    });
  });

  it('says nothing about a conversation there is none of', () => {
    expect(
      RunSpecContract.continuityOf(Continuity.of({ key })),
    ).not.toHaveProperty('sessionId');
  });
});

describe('RunSpecContract.checkoutFoldersIn', () => {
  it('reads the folders stored checkouts were laid out in', () => {
    expect(
      RunSpecContract.checkoutFoldersIn([
        { remote: 'https://github.com/acme/api', path: 'api' },
        { remote: 'https://github.com/acme/web' },
      ]),
    ).toEqual(['api']);
    expect(RunSpecContract.checkoutFoldersIn(null)).toEqual([]);
  });

  it('refuses checkouts that are not what a run stores', () => {
    expect(() => RunSpecContract.checkoutFoldersIn([{ path: 'api' }])).toThrow(
      InvalidRunSpecError,
    );
    expect(() => RunSpecContract.checkoutFoldersIn('api')).toThrow(
      InvalidRunSpecError,
    );
  });
});
