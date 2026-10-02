import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InvalidStartingPointHoldError } from '@work/domain/exceptions/invalid-starting-point-hold.error';

const MOST_HOLDER_LENGTH = 200;
export const MOST_HELD_RUNS = 500;

const holderNamed = (holder: string): string => {
  const named = holder.trim();

  if (named.length === 0 || named.length > MOST_HOLDER_LENGTH) {
    throw new InvalidStartingPointHoldError(
      `is held by someone named in 1 to ${MOST_HOLDER_LENGTH} characters`,
    );
  }

  return named;
};

export class StartingPointHold {
  private constructor(
    readonly holder: string,
    readonly workspaceId: WorkspaceId,
    readonly runs: readonly RunId[],
    readonly version: number,
    readonly isReleased: boolean,
  ) {}

  static taken(holder: string, workspaceId: WorkspaceId): StartingPointHold {
    return new StartingPointHold(
      holderNamed(holder),
      workspaceId,
      [],
      0,
      false,
    );
  }

  static rehydrate(input: {
    holder: string;
    workspaceId: WorkspaceId;
    runs: readonly RunId[];
    version: number;
  }): StartingPointHold {
    return new StartingPointHold(
      input.holder,
      input.workspaceId,
      input.runs,
      input.version,
      false,
    );
  }

  holding(runs: readonly RunId[]): StartingPointHold {
    const held = [...new Set(runs.map((each) => each.value))];

    if (held.length > MOST_HELD_RUNS) {
      throw new InvalidStartingPointHoldError(
        `holds at most ${MOST_HELD_RUNS} runs`,
      );
    }

    return new StartingPointHold(
      this.holder,
      this.workspaceId,
      held.map((each) => RunId.of(each)),
      this.version,
      false,
    );
  }

  released(): StartingPointHold {
    return new StartingPointHold(
      this.holder,
      this.workspaceId,
      [],
      this.version,
      true,
    );
  }

  holds(run: RunId): boolean {
    return !this.isReleased && this.runs.some((each) => each.equals(run));
  }
}
