import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';

export interface HistoryScope {
  readonly stationId: StationId;
  readonly hiddenTaskIds: readonly TaskId[];
  readonly shownRunIds: readonly RunId[];
}

export interface HistoryReader {
  readonly trial: { readonly asOf: Date | null } | null;
  readonly actsBeyondItself: boolean;
  readonly scope: HistoryScope | null;
}

export class HistoryAccess {
  private constructor(
    private readonly trial: boolean,
    readonly asOf: Date | null,
    private readonly scope: HistoryScope | null,
  ) {}

  static for(reader: HistoryReader): HistoryAccess | null {
    if (reader.trial) {
      return new HistoryAccess(true, reader.trial.asOf, null);
    }

    if (reader.actsBeyondItself) {
      return new HistoryAccess(false, null, null);
    }

    return reader.scope ? new HistoryAccess(false, null, reader.scope) : null;
  }

  get isScoped(): boolean {
    return this.scope !== null;
  }

  get hiddenTaskIds(): readonly TaskId[] {
    return this.scope?.hiddenTaskIds ?? [];
  }

  assertReadsTraces(): void {
    if (this.trial) {
      throw new NotAllowedForIsolatedRunError('read a task’s trace');
    }
  }

  seesRunAt(stationId: StationId | null): boolean {
    return !this.scope || stationId?.equals(this.scope.stationId) === true;
  }

  hides(taskId: TaskId): boolean {
    return this.hiddenTaskIds.some((hidden) => hidden.equals(taskId));
  }

  shownBeyond(listed: readonly RunId[]): readonly RunId[] {
    return (this.scope?.shownRunIds ?? []).filter(
      (runId) => !listed.some((each) => each.equals(runId)),
    );
  }
}
