import { InvalidRunSpecError } from '@work/domain/exceptions/invalid-run-spec.error';
import {
  RunSpec,
  type RunSpecParts,
} from '@work/domain/value-objects/run-spec.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const parts = (over: Partial<RunSpecParts> = {}): RunSpecParts => ({
  command: { executable: 'claude-agent-acp', args: [] },
  briefing: 'do the thing',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  resume: { key: 'task-task_1' },
  ...over,
});

describe('RunSpec', () => {
  it('takes a spec with everything it needs', () => {
    expect(RunSpec.of(parts()).value).toEqual(parts());
  });

  it('injects secrets only by their names', () => {
    expect(
      RunSpec.of(
        parts({ injectedSecrets: ['LINEAR_API_KEY'] }),
      ).injectedSecrets.map((each) => each.value),
    ).toEqual(['LINEAR_API_KEY']);
    expect(() =>
      RunSpec.of(parts({ injectedSecrets: ['linear key'] })),
    ).toThrow(InvalidRunSpecError);
  });

  it('carries on the work its resume key names, and its conversation only once there is one', () => {
    const afresh = RunSpec.of(parts());
    const continuing = RunSpec.of(
      parts({ resume: { key: 'task-task_1', sessionId: 's_1' } }),
    );

    expect(afresh.resumeKey?.value).toBe('task-task_1');
    expect(afresh.continuesASession).toBe(false);
    expect(continuing.continuesASession).toBe(true);
    expect(RunSpec.of(parts({ resume: { key: ' ' } })).resumeKey).toBeNull();
  });

  it('keeps that the run reports the diff it leaves', () => {
    expect(RunSpec.of(parts({ diffs: true })).value.diffs).toBe(true);
    expect(RunSpec.of(parts()).value.diffs).toBeUndefined();
  });

  it('keeps the check its change must pass, so a later station edit does not change it', () => {
    expect(RunSpec.of(parts({ check: 'npm test' })).check).toBe('npm test');
    expect(RunSpec.of(parts()).check).toBeNull();
    expect(() => RunSpec.of(parts({ check: '  ' }))).toThrow(
      InvalidRunSpecError,
    );
  });

  it('rejects one that says nothing to do, or nothing to run', () => {
    expect(() => RunSpec.of(parts({ briefing: '  ' }))).toThrow(
      InvalidRunSpecError,
    );
    expect(() =>
      RunSpec.of(parts({ command: { executable: ' ', args: [] } })),
    ).toThrow(InvalidRunSpecError);
  });

  it('rejects a note limit it cannot keep to', () => {
    for (const noteLimit of [-1, 1.5, Number.NaN]) {
      expect(() =>
        RunSpec.of(parts({ handover: { options: [], noteLimit } })),
      ).toThrow(InvalidRunSpecError);
    }
  });

  it('rejects a checkout that points outside the workspace', () => {
    for (const path of ['/etc', '../elsewhere', 'a/../../b']) {
      expect(() =>
        RunSpec.of(
          parts({ checkouts: [{ remote: 'spotlight:repository', path }] }),
        ),
      ).toThrow(InvalidRunSpecError);
    }
  });

  it('rejects a checkout that comes from nowhere', () => {
    expect(() =>
      RunSpec.of(parts({ checkouts: [{ remote: '  ', path: 'widgets' }] })),
    ).toThrow(InvalidRunSpecError);
  });

  it('is joined by the checkouts it does not have yet, and keeps the ones it has', () => {
    const widgets = {
      remote: 'spotlight:repository',
      path: 'widgets',
      branch: 'spotlight/task-1',
    };
    const config = {
      remote: 'spotlight:repository',
      path: 'config',
      branch: 'spotlight/task-1',
      setup: 'terraform version',
    };
    const spec = RunSpec.of(parts({ checkouts: [widgets] }));

    expect(
      spec.join([{ ...widgets, setup: 'npm ci' }, config]).value.checkouts,
    ).toEqual([widgets, config]);
    expect(
      spec.join([config, { ...config, branch: 'other' }]).value.checkouts,
    ).toEqual([widgets, config]);
    expect(spec.join([widgets])).toBe(spec);
    expect(spec.join([{ remote: 'spotlight:repository' }])).toBe(spec);
    expect(spec.join([{ remote: 'spotlight:repository', path: ' ' }])).toBe(
      spec,
    );
  });

  it('rejects a skill or attachment laid outside the workspace', () => {
    expect(() =>
      RunSpec.of(parts({ skills: [{ path: '/root/SKILL.md', text: '' }] })),
    ).toThrow(InvalidRunSpecError);
    expect(() => RunSpec.of(parts({ skillHomes: ['../skills'] }))).toThrow(
      InvalidRunSpecError,
    );
    expect(() =>
      RunSpec.of(parts({ settingFiles: ['../claude/settings.json'] })),
    ).toThrow(InvalidRunSpecError);
    expect(() =>
      RunSpec.of(parts({ attachments: [{ id: 'a', path: '../secret' }] })),
    ).toThrow(InvalidRunSpecError);
  });

  it('enables the tools its manifest names, and no others', () => {
    const spec = RunSpec.of(
      parts({
        manifest: [
          {
            name: 'pull-request',
            description: 'open',
            inputs: [],
            approval: null,
          },
        ],
      }),
    );

    expect(spec.enables(Tool.of('pull-request'))).toBe(true);
    expect(spec.enables(Tool.of('merge'))).toBe(false);
    expect(RunSpec.of(parts()).enables(Tool.of('pull-request'))).toBe(false);
  });

  it('keeps nothing it was not described by', () => {
    const loose = { ...parts(), anything: { else: true } } as RunSpecParts;

    expect(RunSpec.of(loose).value).toEqual(parts());
  });

  it('is equal to a spec described the same way', () => {
    expect(RunSpec.of(parts()).equals(RunSpec.of(parts()))).toBe(true);
    expect(
      RunSpec.of(parts()).equals(RunSpec.of(parts({ briefing: 'other' }))),
    ).toBe(false);
  });

  describe('a replay', () => {
    const COMMIT = 'c'.repeat(40);
    const replayed = (over: Partial<RunSpecParts> = {}): RunSpecParts =>
      parts({
        checkouts: [
          { remote: 'spotlight:repository', path: 'api', ref: COMMIT },
        ],
        resume: { key: 'replay-run_1' },
        replay: {
          archive: 'archive_1',
          checkouts: [{ path: 'api', commit: COMMIT, repository: 'acme/api' }],
          movesOnAfter: ['spec'],
        },
        ...over,
      });

    it('says what it replays: the archive it starts from and the commit of each checkout', () => {
      const spec = RunSpec.of(replayed());

      expect(spec.isReplay).toBe(true);
      expect(spec.replay).toEqual({
        archive: 'archive_1',
        checkouts: [{ path: 'api', commit: COMMIT, repository: 'acme/api' }],
        movesOnAfter: ['spec'],
      });
      expect(RunSpec.of(parts()).isReplay).toBe(false);
      expect(RunSpec.of(parts()).replay).toBeNull();
    });

    it('enables no tools, MCP servers or secrets for a replay', () => {
      for (const parts of [
        { injectedSecrets: ['LINEAR_API_KEY'] },
        {
          manifest: [
            {
              name: 'core.comment',
              description: 'x',
              inputs: [],
              approval: null,
            },
          ],
        },
        { catalog: ['catalog.web-search@1.1.0'] },
        {
          harnessSetup: {
            files: [],
            mcpServers: [{ name: 'linear', command: 'npx', args: [], env: [] }],
            askKinds: [],
          },
        },
      ]) {
        expect(() => RunSpec.of(replayed(parts))).toThrow(InvalidRunSpecError);
      }
    });

    it('hands over the diff it leaves, for its candidate’s own check to judge', () => {
      const spec = RunSpec.of(replayed({ diffs: true, check: 'npm test' }));

      expect(spec.value.diffs).toBe(true);
      expect(spec.check).toBe('npm test');
    });

    it('never reports where it started, nor carries on a conversation', () => {
      expect(() => RunSpec.of(replayed({ startingPoint: true }))).toThrow(
        InvalidRunSpecError,
      );
      expect(() =>
        RunSpec.of(
          replayed({ resume: { key: 'replay-run_1', sessionId: 's_1' } }),
        ),
      ).toThrow(InvalidRunSpecError);
    });

    it('checks out exactly the commits it replays, on no branch', () => {
      for (const checkouts of [
        [{ remote: 'spotlight:repository', path: 'api' }],
        [{ remote: 'spotlight:repository', path: 'api', ref: 'd'.repeat(40) }],
        [
          {
            remote: 'spotlight:repository',
            path: 'api',
            ref: COMMIT,
            branch: 'spotlight/task_1',
          },
        ],
        [
          { remote: 'spotlight:repository', path: 'api', ref: COMMIT },
          { remote: 'spotlight:repository', path: 'web', ref: COMMIT },
        ],
        [],
      ]) {
        expect(() => RunSpec.of(replayed({ checkouts }))).toThrow(
          InvalidRunSpecError,
        );
      }
    });
  });

  describe('a search', () => {
    const searching = (over: Partial<RunSpecParts> = {}): RunSpecParts =>
      parts({
        handover: { options: [], noteLimit: 0 },
        resume: { key: 'search-run_1' },
        search: {},
        ...over,
      });

    it('says it searches, and carries that through', () => {
      const spec = RunSpec.of(searching());

      expect(spec.isSearch).toBe(true);
      expect(spec.isReplay).toBe(false);
      expect(spec.value.search).toEqual({});
      expect(RunSpec.of(parts()).isSearch).toBe(false);
    });

    it('allows a search no checkouts, tools, MCP servers, secrets, attachments, skills or harness settings', () => {
      for (const parts of [
        { checkouts: [{ remote: 'spotlight:repository', path: 'api' }] },
        { injectedSecrets: ['LINEAR_API_KEY'] },
        {
          manifest: [
            {
              name: 'core.comment',
              description: 'x',
              inputs: [],
              approval: null,
            },
          ],
        },
        { catalog: ['catalog.web-search@1.1.0'] },
        {
          harnessSetup: {
            files: [],
            mcpServers: [{ name: 'linear', command: 'npx', args: [], env: [] }],
            askKinds: [],
          },
        },
        { attachments: [{ id: 'file_1', path: 'brief.png' }] },
        { skills: [{ path: '.claude/skills/x/SKILL.md', text: '# X' }] },
        { skillHomes: ['.claude/skills'] },
        { settingFiles: ['.claude/settings.json'] },
        {
          harnessSetup: {
            files: [{ path: 'settings.json', text: '{}' }],
            mcpServers: [],
            askKinds: [],
          },
        },
      ]) {
        expect(() => RunSpec.of(searching(parts))).toThrow(InvalidRunSpecError);
      }
    });

    it('never reports where it started, carries on a conversation, replays at once, hands over a diff, checks a change or hands work on', () => {
      for (const parts of [
        { startingPoint: true },
        { resume: { key: 'search-run_1', sessionId: 's_1' } },
        {
          replay: { archive: null, checkouts: [], movesOnAfter: [] },
        },
        { diffs: true },
        { check: 'npm test' },
        { handover: { options: ['review'], noteLimit: 0 } },
        { handover: { options: [], noteLimit: 4_000 } },
      ]) {
        expect(() => RunSpec.of(searching(parts))).toThrow(InvalidRunSpecError);
      }
    });
  });
});
