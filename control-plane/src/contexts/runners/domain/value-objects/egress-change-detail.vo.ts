import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class EgressChangeDetail implements ChangeDetail {
  private constructor(readonly rekeyed: boolean) {}

  static updated(moved: { rekeyed: boolean }): EgressChangeDetail {
    return new EgressChangeDetail(moved.rekeyed);
  }

  recorded(): RecordedDetail {
    return this.rekeyed ? { rekeyed: true } : {};
  }
}
