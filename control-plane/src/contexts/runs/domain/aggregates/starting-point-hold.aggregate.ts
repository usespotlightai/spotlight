import { InvalidStartingPointHoldError } from '@runs/domain/exceptions/invalid-starting-point-hold.error';
import { HoldHolder } from '@runs/domain/value-objects/hold-holder.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MAX_HELD_RUNS = 500;

export class StartingPointHold {
  private constructor(
    readonly holder: HoldHolder,
    readonly workspaceId: WorkspaceId,
    readonly runs: readonly RunId[],
    readonly version: number,
    readonly isReleased: boolean,
  ) {}

  static take(holder: HoldHolder, workspaceId: WorkspaceId): StartingPointHold {
    return new StartingPointHold(holder, workspaceId, [], 0, false);
  }

  static rehydrate(input: {
    holder: string;
    workspaceId: WorkspaceId;
    runs: readonly RunId[];
    version: number;
  }): StartingPointHold {
    if (input.runs.length === 0 || input.runs.length > MAX_HELD_RUNS) {
      throw new InconsistentStateError(
        'starting point hold',
        `${input.holder} holds ${input.runs.length} runs`,
      );
    }

    return new StartingPointHold(
      HoldHolder.of(input.holder),
      input.workspaceId,
      input.runs,
      input.version,
      false,
    );
  }

  holding(runs: readonly RunId[], workspaceId: WorkspaceId): StartingPointHold {
    if (!workspaceId.equals(this.workspaceId)) {
      throw new InvalidStartingPointHoldError(
        'can hold only runs of its own workspace',
      );
    }

    const held = [...new Set(runs.map((each) => each.value))];

    if (held.length === 0) {
      return this.released();
    }

    if (held.length > MAX_HELD_RUNS) {
      throw new InvalidStartingPointHoldError(
        `can hold at most ${MAX_HELD_RUNS} runs`,
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
