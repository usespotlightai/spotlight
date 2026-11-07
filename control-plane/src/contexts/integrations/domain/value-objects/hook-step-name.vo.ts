import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const STEP_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class HookStepName {
  private readonly kind = 'hook-step-name';

  private constructor(readonly value: string) {}

  static rehydrate(stored: string): HookStepName {
    try {
      return HookStepName.of(stored);
    } catch {
      throw new InconsistentStateError(
        'hook step name',
        'was stored in a shape it cannot take',
      );
    }
  }

  static of(raw: string): HookStepName {
    if (!STEP_NAME.test(raw)) {
      throw new InvalidIdentifierError(
        'hook step',
        'is named in lowercase words joined by dashes, as in notify',
      );
    }

    return new HookStepName(raw);
  }

  equals(other: HookStepName): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
