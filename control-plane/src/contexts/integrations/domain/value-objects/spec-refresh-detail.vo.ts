import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class SpecRefreshDetail implements ChangeDetail {
  private constructor(
    readonly hash: string | null,
    readonly problem: string | null,
    readonly orphanedTools: readonly string[],
  ) {}

  static of(input: {
    hash: string | null;
    problem: string | null;
    orphanedTools: readonly string[];
  }): SpecRefreshDetail {
    return new SpecRefreshDetail(input.hash, input.problem, [
      ...input.orphanedTools,
    ]);
  }

  recorded(): RecordedDetail {
    return {
      refreshedSpec: this.hash,
      ...(this.problem ? { problem: this.problem } : {}),
      ...(this.orphanedTools.length > 0
        ? { orphanedTools: this.orphanedTools }
        : {}),
    };
  }
}
