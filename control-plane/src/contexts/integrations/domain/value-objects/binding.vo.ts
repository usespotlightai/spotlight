import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

export class Binding {
  private constructor(
    readonly event: string,
    readonly does: string,
  ) {}

  static of(input: {
    event: string;
    does: string;
    known: readonly string[];
  }): Binding {
    if (!input.known.includes(input.event)) {
      throw new InvalidIntegrationPartError(
        `binding on ${input.event}`,
        `is not an event Spotlight raises; expected one of ${input.known.join(', ')}`,
      );
    }

    return new Binding(input.event, input.does);
  }

  isFor(event: string): boolean {
    return this.event === event;
  }
}
