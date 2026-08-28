import type { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessName } from '@domain/value-objects/harness-name.vo';

export class Harness {
  private constructor(
    readonly id: HarnessId,
    readonly name: HarnessName,
    readonly command: HarnessCommand,
  ) {}

  static of(input: {
    id: HarnessId;
    name: HarnessName;
    command: HarnessCommand;
  }): Harness {
    return new Harness(input.id, input.name, input.command);
  }

  equals(other: Harness): boolean {
    return this.id.equals(other.id);
  }
}
