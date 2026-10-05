import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class RereadDetail implements ChangeDetail {
  private constructor(
    readonly hash: string | null,
    readonly problem: string | null,
    readonly stranded: readonly string[],
  ) {}

  static of(input: {
    hash: string | null;
    problem: string | null;
    stranded: readonly string[];
  }): RereadDetail {
    return new RereadDetail(input.hash, input.problem, [...input.stranded]);
  }

  recorded(): RecordedDetail {
    return {
      reread: this.hash,
      ...(this.problem ? { problem: this.problem } : {}),
      ...(this.stranded.length > 0 ? { stranded: this.stranded } : {}),
    };
  }
}
