import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

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
    if (!isSlug(raw)) {
      throw InvalidIdentifierError.notSlug('hook step name', 'notify');
    }

    return new HookStepName(raw);
  }

  equals(other: HookStepName): boolean {
    return other instanceof HookStepName && this.value === other.value;
  }
}
