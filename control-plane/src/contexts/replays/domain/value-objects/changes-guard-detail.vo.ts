import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class ChangesGuardDetail implements ChangeDetail {
  private constructor(readonly guardsChanges: boolean) {}

  static of(guardsChanges: boolean): ChangesGuardDetail {
    return new ChangesGuardDetail(guardsChanges);
  }

  recorded(): RecordedDetail {
    return { guardsChanges: this.guardsChanges };
  }
}
