import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class SecretChangeDetail implements ChangeDetail {
  private constructor(
    readonly valueMoved: boolean,
    readonly valueVersion: number | null,
    readonly targets: readonly string[] | null,
  ) {}

  static created(
    valueVersion: number | null,
    targets: readonly string[],
  ): SecretChangeDetail {
    return new SecretChangeDetail(true, valueVersion, [...targets]);
  }

  static updated(moved: {
    valueMoved: boolean;
    valueVersion: number | null;
    rebound: boolean;
    targets: readonly string[];
  }): SecretChangeDetail {
    return new SecretChangeDetail(
      moved.valueMoved,
      moved.valueMoved ? moved.valueVersion : null,
      moved.rebound ? [...moved.targets] : null,
    );
  }

  recorded(): RecordedDetail {
    return {
      ...(this.valueMoved ? { valueVersion: this.valueVersion } : {}),
      ...(this.targets ? { targets: this.targets } : {}),
    };
  }
}
