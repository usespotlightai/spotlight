import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';

const MAX_SANDBOXES = 1_000;

export class SandboxReport {
  private constructor(
    readonly sandboxes: readonly SandboxId[],
    readonly stopping: boolean,
  ) {}

  static of(input: {
    sandboxes: readonly string[];
    stopping: boolean;
  }): SandboxReport {
    const distinct = [...new Set(input.sandboxes)];

    if (distinct.length > MAX_SANDBOXES) {
      throw new InvalidHostReportError(
        'sandboxes',
        `names more than ${MAX_SANDBOXES} sandboxes`,
      );
    }

    return new SandboxReport(
      distinct.map((id) => SandboxId.of(id)),
      input.stopping,
    );
  }

  includes(id: SandboxId): boolean {
    return this.sandboxes.some((each) => each.equals(id));
  }

  droppedIn(next: SandboxReport): readonly SandboxId[] {
    return this.sandboxes.filter((each) => !next.includes(each));
  }
}
