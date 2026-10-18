import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

export class Binding {
  private constructor(
    readonly event: string,
    readonly action: string,
  ) {}

  static of(input: {
    event: string;
    action: string;
    known: readonly string[];
  }): Binding {
    if (!input.known.includes(input.event)) {
      throw new InvalidIntegrationPartError(
        `binding on ${input.event}`,
        `must be one of ${input.known.join(', ')}`,
      );
    }

    return new Binding(input.event, input.action);
  }

  isFor(event: string): boolean {
    return this.event === event;
  }
}
