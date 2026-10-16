import type { PoolMode } from '@runners/domain/value-objects/pool-access.vo';
import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class RunnerPoolChangeDetail implements ChangeDetail {
  private constructor(
    readonly mode: PoolMode,
    readonly rekeyed: boolean,
    readonly secretRotated: boolean,
    readonly egressMoved: boolean,
  ) {}

  static defined(mode: PoolMode): RunnerPoolChangeDetail {
    return new RunnerPoolChangeDetail(mode, false, false, false);
  }

  static redefined(
    mode: PoolMode,
    moved: { rekeyed: boolean; secretRotated: boolean; egressMoved?: boolean },
  ): RunnerPoolChangeDetail {
    return new RunnerPoolChangeDetail(
      mode,
      moved.rekeyed,
      moved.secretRotated,
      moved.egressMoved ?? false,
    );
  }

  recorded(): RecordedDetail {
    return {
      mode: this.mode,
      ...(this.rekeyed ? { rekeyed: true } : {}),
      ...(this.secretRotated ? { secretRotated: true } : {}),
      ...(this.egressMoved ? { egressMoved: true } : {}),
    };
  }
}
