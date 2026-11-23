import type { PoolMode } from '@runners/domain/value-objects/pool-access.vo';
import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class RunnerPoolChangeDetail implements ChangeDetail {
  private constructor(
    readonly mode: PoolMode,
    readonly tokenRotated: boolean,
    readonly secretRotated: boolean,
    readonly egressChanged: boolean,
    readonly disabled: boolean | null = null,
    readonly allowsSecrets: boolean | null = null,
    readonly allowsReviewWork: boolean | null = null,
  ) {}

  static created(mode: PoolMode): RunnerPoolChangeDetail {
    return new RunnerPoolChangeDetail(mode, false, false, false);
  }

  static updated(
    mode: PoolMode,
    moved: {
      tokenRotated: boolean;
      secretRotated: boolean;
      egressChanged?: boolean;
      disabled?: boolean;
      allowsSecrets?: boolean;
      allowsReviewWork?: boolean;
    },
  ): RunnerPoolChangeDetail {
    return new RunnerPoolChangeDetail(
      mode,
      moved.tokenRotated,
      moved.secretRotated,
      moved.egressChanged ?? false,
      moved.disabled ?? null,
      moved.allowsSecrets ?? null,
      moved.allowsReviewWork ?? null,
    );
  }

  recorded(): RecordedDetail {
    return {
      mode: this.mode,
      ...(this.tokenRotated ? { tokenRotated: true } : {}),
      ...(this.secretRotated ? { secretRotated: true } : {}),
      ...(this.egressChanged ? { egressChanged: true } : {}),
      ...(typeof this.disabled === 'boolean'
        ? { disabled: this.disabled }
        : {}),
      ...(typeof this.allowsSecrets === 'boolean'
        ? { allowsSecrets: this.allowsSecrets }
        : {}),
      ...(typeof this.allowsReviewWork === 'boolean'
        ? { allowsReviewWork: this.allowsReviewWork }
        : {}),
    };
  }
}
