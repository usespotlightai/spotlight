import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';

export class Refusal {
  private constructor(
    readonly tool: string,
    readonly server: string | null,
    readonly at: Date,
  ) {}

  static of(input: { tool: string; server: string | null; at: Date }): Refusal {
    if (input.tool.trim().length === 0) {
      throw new InvalidOutcomeError('names the tool a person refused');
    }
    if (input.server !== null && input.server.trim().length === 0) {
      throw new InvalidOutcomeError('names the server of a refused tool');
    }

    return new Refusal(input.tool.trim(), input.server, input.at);
  }

  sameAs(other: Refusal): boolean {
    return (
      this.tool === other.tool &&
      this.server === other.server &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
