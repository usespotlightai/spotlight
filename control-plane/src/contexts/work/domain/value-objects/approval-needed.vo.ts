import { InvalidToolError } from '@work/domain/exceptions/invalid-tool.error';

export class ApprovalNeeded {
  private constructor(readonly because: string) {}

  static of(tool: string, because: string): ApprovalNeeded {
    const said = because.trim();

    if (said.length === 0) {
      throw new InvalidToolError(tool, 'needs approval, so it must say why');
    }

    return new ApprovalNeeded(said);
  }

  equals(other: ApprovalNeeded): boolean {
    return this.because === other.because;
  }
}
