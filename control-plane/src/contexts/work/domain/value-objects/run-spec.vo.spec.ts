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
  continuity: { key: 'task_1-station_1' },
  ...over,
});

describe('RunSpec', () => {
  it('takes a spec with everything it needs', () => {
    expect(RunSpec.of(parts()).value).toEqual(parts());
  });

  it('wears secrets only by their names', () => {
    expect(
      RunSpec.of(parts({ wears: ['LINEAR_API_KEY'] })).wears.map(
        (each) => each.value,
      ),
    ).toEqual(['LINEAR_API_KEY']);
    expect(() => RunSpec.of(parts({ wears: ['linear key'] }))).toThrow(
      InvalidRunSpecError,
    );
  });

  it('carries on the work its continuity names, and its conversation only once there is one', () => {
    const afresh = RunSpec.of(parts());
    const continuing = RunSpec.of(
      parts({ continuity: { key: 'task_1-station_1', sessionId: 's_1' } }),
    );

    expect(afresh.continuity?.value).toBe('task_1-station_1');
    expect(afresh.continuesASession).toBe(false);
    expect(continuing.continuesASession).toBe(true);
    expect(
      RunSpec.of(parts({ continuity: { key: ' ' } })).continuity,
    ).toBeNull();
  });

  it('keeps that the run reports the diff it leaves', () => {
    expect(RunSpec.of(parts({ diffs: true })).value.diffs).toBe(true);
    expect(RunSpec.of(parts()).value.diffs).toBeUndefined();
  });

  it('refuses one that says nothing to do, or nothing to run', () => {
    expect(() => RunSpec.of(parts({ briefing: '  ' }))).toThrow(
      InvalidRunSpecError,
    );
    expect(() =>
      RunSpec.of(parts({ command: { executable: ' ', args: [] } })),
    ).toThrow(InvalidRunSpecError);
  });

  it('refuses a note limit it cannot be held to', () => {
    for (const noteLimit of [-1, 1.5, Number.NaN]) {
      expect(() =>
        RunSpec.of(parts({ handover: { options: [], noteLimit } })),
      ).toThrow(InvalidRunSpecError);
    }
  });

  it('refuses a checkout that reaches outside the workspace', () => {
    for (const path of ['/etc', '../elsewhere', 'a/../../b']) {
      expect(() =>
        RunSpec.of(
          parts({ checkouts: [{ remote: 'spotlight:repository', path }] }),
        ),
      ).toThrow(InvalidRunSpecError);
    }
  });

  it('refuses a checkout that comes from nowhere', () => {
    expect(() =>
      RunSpec.of(parts({ checkouts: [{ remote: '  ', path: 'widgets' }] })),
    ).toThrow(InvalidRunSpecError);
  });

  it('refuses a skill or attachment laid outside the workspace', () => {
    expect(() =>
      RunSpec.of(parts({ skills: [{ path: '/root/SKILL.md', text: '' }] })),
    ).toThrow(InvalidRunSpecError);
    expect(() =>
      RunSpec.of(parts({ attachments: [{ id: 'a', path: '../secret' }] })),
    ).toThrow(InvalidRunSpecError);
  });

  it('gives the tools its manifest names, and no others', () => {
    const spec = RunSpec.of(
      parts({
        manifest: [{ name: 'pull-request', description: 'open', inputs: [] }],
      }),
    );

    expect(spec.gives(Tool.of('pull-request'))).toBe(true);
    expect(spec.gives(Tool.of('merge'))).toBe(false);
    expect(RunSpec.of(parts()).gives(Tool.of('pull-request'))).toBe(false);
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
