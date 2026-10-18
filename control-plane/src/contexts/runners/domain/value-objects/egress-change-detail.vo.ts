import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class EgressChangeDetail implements ChangeDetail {
  private constructor(readonly tokenRotated: boolean) {}

  static updated(moved: { tokenRotated: boolean }): EgressChangeDetail {
    return new EgressChangeDetail(moved.tokenRotated);
  }

  recorded(): RecordedDetail {
    return this.tokenRotated ? { tokenRotated: true } : {};
  }
}
