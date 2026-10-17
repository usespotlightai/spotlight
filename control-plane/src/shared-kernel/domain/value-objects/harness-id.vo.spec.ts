import { InvalidHarnessIdError } from '@shared-kernel/domain/exceptions/invalid-harness-id.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { describe, expect, it } from 'vitest';

describe('HarnessId', () => {
  it('rejects a name that names nothing', () => {
    expect(() => HarnessId.of('   ')).toThrow(InvalidHarnessIdError);
  });

  it('takes a name without the whitespace around it', () => {
    expect(HarnessId.of('  claude-code  ').value).toBe('claude-code');
  });

  it('is the same harness as one named the same way', () => {
    expect(
      HarnessId.of('claude-code').equals(HarnessId.of('claude-code')),
    ).toBe(true);
    expect(HarnessId.of('claude-code').equals(HarnessId.of('other'))).toBe(
      false,
    );
  });
});
