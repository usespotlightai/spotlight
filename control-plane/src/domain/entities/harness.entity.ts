import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessName } from '@domain/value-objects/harness-name.vo';

export class Harness {
  private constructor(
    readonly id: HarnessId,
    readonly name: HarnessName,
  ) {}

  static of(input: { id: HarnessId; name: HarnessName }): Harness {
    return new Harness(input.id, input.name);
  }

  equals(other: Harness): boolean {
    return this.id.equals(other.id);
  }
}
