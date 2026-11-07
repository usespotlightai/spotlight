import { HarnessName } from '@runs/domain/value-objects/harness-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

describe('HarnessName', () => {
  it('rejects a name that names nothing', () => {
    expect(() => HarnessName.of('   ')).toThrow(InconsistentStateError);
  });

  it('rejects a name too long to read', () => {
    expect(() => HarnessName.of('a'.repeat(101))).toThrow(
      InconsistentStateError,
    );
  });

  it('takes a name without the whitespace around it', () => {
    expect(HarnessName.of('  Claude Code  ').value).toBe('Claude Code');
  });

  it('is the same name as one written the same way', () => {
    expect(
      HarnessName.of('Claude Code').equals(HarnessName.of('Claude Code')),
    ).toBe(true);
    expect(HarnessName.of('Claude Code').equals(HarnessName.of('Other'))).toBe(
      false,
    );
  });
});
