import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';

export class Dismissal {
  private constructor(
    readonly tool: string,
    readonly server: string | null,
    readonly at: Date,
  ) {}

  static of(input: {
    tool: string;
    server: string | null;
    at: Date;
  }): Dismissal {
    if (input.tool.trim().length === 0) {
      throw new InvalidOutcomeError('dismissal must name the tool');
    }
    if (input.server !== null && input.server.trim().length === 0) {
      throw new InvalidOutcomeError('dismissal server cannot be blank');
    }

    return new Dismissal(input.tool.trim(), input.server, input.at);
  }

  sameAs(other: Dismissal): boolean {
    return (
      this.tool === other.tool &&
      this.server === other.server &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
