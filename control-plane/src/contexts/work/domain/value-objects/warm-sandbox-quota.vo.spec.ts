import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WarmSandboxQuota } from '@work/domain/value-objects/warm-sandbox-quota.vo';
import { describe, expect, it } from 'vitest';

describe('WarmSandboxQuota', () => {
  it('keeps a whole number of warm sandboxes, none by default', () => {
    expect(WarmSandboxQuota.of(0)).toBe(WarmSandboxQuota.NONE);
    expect(WarmSandboxQuota.of(3).value).toBe(3);
    expect(WarmSandboxQuota.of(3).isNone).toBe(false);
  });

  it('refuses a negative or fractional number', () => {
    expect(() => WarmSandboxQuota.of(-1)).toThrow(InconsistentStateError);
    expect(() => WarmSandboxQuota.of(1.5)).toThrow(InconsistentStateError);
  });
});
