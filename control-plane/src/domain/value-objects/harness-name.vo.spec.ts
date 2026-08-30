import { InvalidHarnessNameError } from '@domain/exceptions/invalid-harness-name.error';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { describe, expect, it } from 'vitest';

describe('HarnessName', () => {
  it('refuses a name that names nothing', () => {
    expect(() => HarnessName.of('   ')).toThrow(InvalidHarnessNameError);
  });

  it('refuses a name too long to read', () => {
    expect(() => HarnessName.of('a'.repeat(101))).toThrow(
      InvalidHarnessNameError,
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
