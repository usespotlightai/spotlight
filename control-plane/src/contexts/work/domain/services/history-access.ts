import { NotAllowedForIsolatedRunError } from '@work/domain/exceptions/not-allowed-for-isolated-run.error';

export interface HistoryScope {
  readonly stationId: string;
  readonly hiddenTaskIds: readonly string[];
  readonly shownRunIds: readonly string[];
}

export class HistoryAccess {
  private constructor(
    private readonly trial: boolean,
    readonly asOf: Date | null,
    private readonly scope: HistoryScope | null,
  ) {}

  static unrestricted(): HistoryAccess {
    return new HistoryAccess(false, null, null);
  }

  static ofTrial(asOf: Date | null): HistoryAccess {
    return new HistoryAccess(true, asOf, null);
  }

  static scopedTo(scope: HistoryScope): HistoryAccess {
    return new HistoryAccess(false, null, scope);
  }

  get isScoped(): boolean {
    return this.scope !== null;
  }

  get hiddenTaskIds(): readonly string[] {
    return this.scope?.hiddenTaskIds ?? [];
  }

  assertReadsTraces(): void {
    if (this.trial) {
      throw new NotAllowedForIsolatedRunError('read a task’s trace');
    }
  }

  seesRunAt(stationId: string | null): boolean {
    return !this.scope || stationId === this.scope.stationId;
  }

  hides(run: { readonly taskId: string }): boolean {
    return this.hiddenTaskIds.includes(run.taskId);
  }

  shownBeyond(
    listed: readonly { readonly runId: string }[],
  ): readonly string[] {
    return (this.scope?.shownRunIds ?? []).filter(
      (runId) => !listed.some((each) => each.runId === runId),
    );
  }
}
