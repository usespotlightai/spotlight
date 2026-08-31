import { InvalidRunSpecError } from '@domain/exceptions/invalid-run-spec.error';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const command = { executable: 'claude-agent-acp', args: [] };

const parts = (over: Record<string, unknown> = {}) => ({
  command,
  briefing: 'do the thing',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  continuity: { key: 'task_1-station_1', keep: true },
  ...over,
});

describe('RunSpec.of', () => {
  it('takes a spec with everything it needs', () => {
    expect(RunSpec.of(parts()).briefing).toBe('do the thing');
  });

  it('refuses one that says nothing to do, or nothing to run', () => {
    expect(() => RunSpec.of(parts({ briefing: '  ' }))).toThrow(
      InvalidRunSpecError,
    );
    expect(() =>
      RunSpec.of(parts({ command: { executable: ' ', args: [] } })),
    ).toThrow(InvalidRunSpecError);
  });

  it('refuses a handover it cannot be held to', () => {
    expect(() =>
      RunSpec.of(parts({ handover: { noteLimit: 10 } as never })),
    ).toThrow(InvalidRunSpecError);
    expect(() =>
      RunSpec.of(parts({ handover: { options: [], noteLimit: -1 } })),
    ).toThrow(InvalidRunSpecError);
  });

  // The runner clones into whatever a checkout names, so a path leaving the
  // workspace is refused where it is written, not where it is carried out.
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
});

describe('RunSpec.ordered', () => {
  // How to start a harness is Spotlight's, so whatever a caller says about it
  // is replaced rather than trusted.
  it('runs what Spotlight says, not what the caller asked for', () => {
    const spec = RunSpec.ordered(
      {
        briefing: 'do the thing',
        command: { executable: 'rm', args: ['-rf'] },
      },
      command,
    );

    expect(spec.value.command).toEqual(command);
  });

  it('fills in what a caller left out', () => {
    const spec = RunSpec.ordered({ briefing: 'do the thing' }, command);

    expect(spec.value.handover).toEqual({ options: [], noteLimit: 0 });
    expect(spec.value.continuity).toEqual({
      key: '',
      sessionId: undefined,
      keep: false,
    });
  });

  it('refuses what is not a spec at all', () => {
    for (const raw of [null, undefined, 'a spec', 7]) {
      expect(() => RunSpec.ordered(raw, command)).toThrow(InvalidRunSpecError);
    }
  });

  it('holds a caller to the same rules as Spotlight', () => {
    expect(() =>
      RunSpec.ordered(
        { briefing: 'do it', checkouts: [{ remote: 'x', path: '../out' }] },
        command,
      ),
    ).toThrow(InvalidRunSpecError);
  });
});
