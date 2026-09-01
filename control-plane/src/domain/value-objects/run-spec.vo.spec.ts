import { InvalidRunSpecError } from '@domain/exceptions/invalid-run-spec.error';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

describe('RunSpec', () => {
  it('carries the instructions it was given, whole', () => {
    const written = { briefing: 'do the thing', anything: { else: true } };

    expect(RunSpec.of(written).value).toEqual(written);
  });

  it('refuses a run described as nothing at all', () => {
    expect(() => RunSpec.of({})).toThrow(InvalidRunSpecError);
  });

  it('reads back what was stored', () => {
    expect(RunSpec.from({ briefing: 'do the thing' })?.value).toEqual({
      briefing: 'do the thing',
    });
  });

  it('reads back nothing where nothing was stored', () => {
    for (const raw of [null, undefined, 'a spec', 7, []]) {
      expect(RunSpec.from(raw)).toBeNull();
    }
  });
});
