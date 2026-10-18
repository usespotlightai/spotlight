import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class ChangesGateDetail implements ChangeDetail {
  private constructor(readonly gatesChanges: boolean) {}

  static of(gatesChanges: boolean): ChangesGateDetail {
    return new ChangesGateDetail(gatesChanges);
  }

  recorded(): RecordedDetail {
    return { gatesChanges: this.gatesChanges };
  }
}
