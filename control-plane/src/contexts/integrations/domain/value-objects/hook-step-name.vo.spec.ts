import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import { describe, expect, it } from 'vitest';

describe('HookStepName', () => {
  it('is lowercase words joined by dashes', () => {
    expect(HookStepName.of('notify-team').value).toBe('notify-team');
    expect(() => HookStepName.of('Notify')).toThrow();
    expect(() => HookStepName.of('notify team')).toThrow();
    expect(() => HookStepName.of('')).toThrow();
  });
});
