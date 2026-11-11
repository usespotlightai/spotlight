import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('HookStepName', () => {
  it('is lowercase words joined by dashes', () => {
    expect(HookStepName.of('notify-team').value).toBe('notify-team');
    expect(() => HookStepName.of('Notify')).toThrow(InvalidIdentifierError);
    expect(() => HookStepName.of('notify team')).toThrow(
      InvalidIdentifierError,
    );
    expect(() => HookStepName.of('')).toThrow(InvalidIdentifierError);
  });
});
