import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { areWords } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class DefinedActions {
  private constructor(private readonly names: ReadonlySet<string>) {}

  static of(names: readonly string[]): DefinedActions {
    for (const name of names) {
      if (!areWords(name)) {
        throw new InvalidIntegrationPartError(
          `action ${JSON.stringify(name)}`,
          'must be lowercase words joined by dashes, as in post-message',
        );
      }
    }

    return new DefinedActions(new Set(names));
  }

  named(name: string, by: string): string {
    if (!this.names.has(name)) {
      throw new InvalidIntegrationPartError(
        by,
        `names undefined action ${name}`,
      );
    }

    return name;
  }

  has(name: string): boolean {
    return this.names.has(name);
  }

  get all(): readonly string[] {
    return [...this.names];
  }
}
