import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

export class ApprovalNeeded {
  private constructor(readonly because: string) {}

  static of(input: { because: string }, by: string): ApprovalNeeded {
    const because = input.because.trim();

    if (because.length === 0) {
      throw new InvalidIntegrationPartError(
        by,
        'needs approval but gives no reason',
      );
    }

    return new ApprovalNeeded(because);
  }

  equals(other: ApprovalNeeded): boolean {
    return this.because === other.because;
  }
}
