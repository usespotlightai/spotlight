import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunTokenDetail implements ChangeDetail {
  private constructor(
    readonly runId: string,
    readonly attempt: number,
    readonly scopes: readonly string[],
    readonly expiresAt: string,
  ) {}

  static of(minted: {
    runId: RunId;
    attempt: number;
    scopes: readonly string[];
    expiresAt: Date;
  }): RunTokenDetail {
    return new RunTokenDetail(
      minted.runId.value,
      minted.attempt,
      [...minted.scopes],
      minted.expiresAt.toISOString(),
    );
  }

  recorded(): RecordedDetail {
    return {
      run: this.runId,
      attempt: this.attempt,
      scopes: this.scopes,
      expiresAt: this.expiresAt,
    };
  }
}
