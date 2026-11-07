import { RunSpecContract } from '@runs/application/contracts/run-spec.contract';
import { InvalidRunSpecError } from '@runs/domain/exceptions/invalid-run-spec.error';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { Resume } from '@runs/domain/value-objects/resume.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

const command = { executable: 'claude-agent-acp', args: [] };

const parts = (over: Record<string, unknown> = {}) => ({
  command,
  briefing: 'do the thing',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  resume: {},
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
  resume: { sessionId: 'session_1' },
  skills: [{ path: '.claude/skills/triage/SKILL.md', text: '# Triage' }],
  skillHomes: ['.claude/skills', '.spotlight/skills'],
  manifest: [
    {
      name: 'grafana.search',
      description: 'Search dashboards',
      inputs: [
        {
          name: 'query',
          schema: { type: 'string' },
          description: 'What to look for',
          required: true,
          defaulted: false,
          stdin: false,
        },
        {
          name: 'limit',
          schema: { type: 'integer', minimum: 1 },
          required: false,
          defaulted: true,
          stdin: false,
        },
        {
          name: 'filter',
          schema: {
            type: 'object',
            properties: { team: { type: ['string', 'null'] } },
          },
          required: false,
          defaulted: true,
          stdin: false,
        },
      ],
      approval: { because: 'It reads private dashboards.' },
      integration: 'Grafana',
      output: {
        type: 'array',
        items: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title'],
          additionalProperties: false,
        },
      },
    },
    {
      name: 'pull-request',
      description: 'Open a pull request',
      inputs: [],
      approval: null,
    },
  ],
  attachments: [
    { id: 'att_1', path: '.spotlight/attachments/att_1/screen.png' },
  ],
  settingFiles: ['claude/settings.json'],
  injectedSecrets: ['LINEAR_API_KEY'],
};

describe('RunSpecContract wire', () => {
  it('round-trips a spec to the same JSON the runner and the store read', () => {
    const stored = JSON.parse(JSON.stringify(representative));
    const spec = RunSpecContract.from(stored);

    expect(JSON.stringify(RunSpecContract.toWire(spec))).toBe(
      JSON.stringify(representative),
    );
  });

  it('keeps no empty list of injected secrets', () => {
    expect(
      RunSpecContract.from(parts({ injectedSecrets: [] })).value
        .injectedSecrets,
    ).toBeUndefined();
  });

  it('reads the smallest spec a runner can be handed', () => {
    expect(RunSpecContract.from(parts()).value).toEqual(parts());
  });

  it('rejects what is not a spec as a stored run that no longer reads', () => {
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
      parts({
        manifest: [{ name: 'x', description: 'x', inputs: [] }],
      }),
      parts({
        manifest: [
          { name: 'x', description: 'x', inputs: [], approval: { why: 'x' } },
        ],
      }),
      parts({
        manifest: [
          {
            name: 'x',
            description: 'x',
            inputs: [
              {
                name: 'x',
                schema: 'string',
                required: true,
                defaulted: false,
                stdin: false,
              },
            ],
          },
        ],
      }),
      parts({ briefing: '  ' }),
    ]) {
      expect(() => RunSpecContract.from(raw)).toThrow(InconsistentStateError);
    }
  });
});

describe('RunSpecContract.ordered', () => {
  it('runs what Spotlight says, not what the caller requested', () => {
    const spec = RunSpecContract.ordered(
      {
        briefing: 'do the thing',
        command: { executable: 'rm', args: ['-rf'] },
      },
      command,
    );

    expect(spec.spec.value.command).toEqual(command);
  });

  it('fills in what a caller left out', () => {
    const ordered = RunSpecContract.ordered(
      { briefing: 'do the thing' },
      command,
    );

    expect(ordered.spec.value.handover).toEqual({ options: [], noteLimit: 0 });
    expect(ordered.spec.value.resume).toEqual({});
    expect(ordered.key).toBeNull();
  });

  it('passes on the workspace a caller asks to carry on', () => {
    expect(
      RunSpecContract.ordered(
        { briefing: 'do the thing', resume: { key: ' scratch ' } },
        command,
      ).key,
    ).toBe('scratch');
  });

  it('refuses what only Spotlight orders: grants, restores, extensions and injected secrets', () => {
    for (const field of [
      { apiGrant: { actingFor: 'user_1', scopes: ['plan'], lifetimeMs: 1 } },
      { restore: { archive: 'archive_1' } },
      { extensions: { replay: {} } },
      { injectedSecrets: ['LINEAR_API_KEY'] },
    ]) {
      expect(() =>
        RunSpecContract.ordered({ briefing: 'do it', ...field }, command),
      ).toThrow(InvalidRunSpecError);
    }
  });

  it('rejects what is not a spec at all', () => {
    for (const raw of [null, undefined, 'a spec', 7]) {
      expect(() => RunSpecContract.ordered(raw, command)).toThrow(
        InvalidRunSpecError,
      );
    }
  });

  it('keeps a caller to the same rules as Spotlight', () => {
    expect(() =>
      RunSpecContract.ordered(
        { briefing: 'do it', checkouts: [{ remote: 'x', path: '../out' }] },
        command,
      ),
    ).toThrow(InvalidRunSpecError);
  });
});

describe('RunSpecContract.resumeOf', () => {
  it('names the conversation to take up where there is one', () => {
    expect(
      RunSpecContract.resumeOf(
        Resume.of({ sessionId: HarnessSession.of('session_1') }),
      ),
    ).toEqual({ sessionId: 'session_1' });
  });

  it('says nothing about a conversation there is none of', () => {
    expect(RunSpecContract.resumeOf(Resume.of({}))).toEqual({});
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

  it('rejects checkouts that are not what a run stores', () => {
    expect(() => RunSpecContract.checkoutFoldersIn([{ path: 'api' }])).toThrow(
      InvalidRunSpecError,
    );
    expect(() => RunSpecContract.checkoutFoldersIn('api')).toThrow(
      InvalidRunSpecError,
    );
  });
});
