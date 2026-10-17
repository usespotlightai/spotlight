import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidToolError } from '@work/domain/exceptions/invalid-tool.error';

export class ApprovalNeeded {
  private constructor(
    readonly because: string,
    readonly askedOf: UserId | null,
  ) {}

  static of(
    tool: string,
    because: string,
    askedOf: UserId | null = null,
  ): ApprovalNeeded {
    const reason = because.trim();

    if (reason.length === 0) {
      throw new InvalidToolError(tool, 'needs approval, so it must say why');
    }

    return new ApprovalNeeded(reason, askedOf);
  }

  equals(other: ApprovalNeeded): boolean {
    return (
      this.because === other.because &&
      (this.askedOf === null
        ? other.askedOf === null
        : other.askedOf !== null && this.askedOf.equals(other.askedOf))
    );
  }
}
