import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';

export class Refusal {
  private constructor(
    readonly tool: string,
    readonly server: string | null,
    readonly at: Date,
  ) {}

  static of(input: { tool: string; server: string | null; at: Date }): Refusal {
    if (input.tool.trim().length === 0) {
      throw new InvalidOutcomeError('refusal must name the tool');
    }
    if (input.server !== null && input.server.trim().length === 0) {
      throw new InvalidOutcomeError('refusal server cannot be blank');
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
