import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class RunnerChangeDetail implements ChangeDetail {
  private constructor(
    readonly trust: string | null,
    readonly rekeyed: boolean,
  ) {}

  static enrolledUnder(trust: RunnerTrustId | null): RunnerChangeDetail {
    return new RunnerChangeDetail(trust?.value ?? null, false);
  }

  static redefined(rekeyed: boolean): RunnerChangeDetail {
    return new RunnerChangeDetail(null, rekeyed);
  }

  recorded(): RecordedDetail {
    return {
      ...(this.trust ? { trust: this.trust } : {}),
      ...(this.rekeyed ? { rekeyed: true } : {}),
    };
  }
}
