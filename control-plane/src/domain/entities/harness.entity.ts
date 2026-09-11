import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessName } from '@domain/value-objects/harness-name.vo';

/**
 * A harness as the domain knows it: an id and a name. How one is started lives
 * behind the launch port, out of here.
 */
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
