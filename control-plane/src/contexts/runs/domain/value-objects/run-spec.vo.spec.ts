import { InvalidRunSpecError } from '@runs/domain/exceptions/invalid-run-spec.error';
import {
  actsBeyondItselfIn,
  RunSpec,
  type RunSpecParts,
} from '@runs/domain/value-objects/run-spec.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const parts = (over: Partial<RunSpecParts> = {}): RunSpecParts => ({
  command: { executable: 'claude-agent-acp', args: [] },
  briefing: 'do the thing',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  resume: {},
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

  it('carries on its conversation only once there is one', () => {
    const afresh = RunSpec.of(parts());
    const continuing = RunSpec.of(parts({ resume: { sessionId: 's_1' } }));

    expect(afresh.continuesASession).toBe(false);
    expect(continuing.continuesASession).toBe(true);
  });

  it('says what acts beyond the run itself', () => {
    expect(actsBeyondItselfIn(parts())).toBeNull();
    expect(
      actsBeyondItselfIn(parts({ injectedSecrets: ['LINEAR_API_KEY'] })),
    ).not.toBeNull();
    expect(actsBeyondItselfIn(parts({ spotlightApi: true }))).not.toBeNull();
    expect(
      actsBeyondItselfIn(parts({ catalog: ['linear.comment'] })),
    ).not.toBeNull();
    expect(actsBeyondItselfIn(parts({ startingPoint: true }))).not.toBeNull();
    expect(
      actsBeyondItselfIn(parts({ resume: { resumeSession: true } })),
    ).not.toBeNull();
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

  it('rejects a checkout that points outside the working copy', () => {
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

  it('rejects a skill or attachment laid outside the working copy', () => {
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
});
