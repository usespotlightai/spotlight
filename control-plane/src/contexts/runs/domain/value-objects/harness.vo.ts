import type { HarnessName } from '@runs/domain/value-objects/harness-name.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';

export class Harness {
  private constructor(
    readonly id: HarnessId,
    readonly name: HarnessName,
  ) {}

  static of(input: { id: HarnessId; name: HarnessName }): Harness {
    return new Harness(input.id, input.name);
  }

  equals(other: Harness): boolean {
    return this.id.equals(other.id) && this.name.equals(other.name);
  }
}
