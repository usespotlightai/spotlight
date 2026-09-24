import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class SecretChangeDetail implements ChangeDetail {
  private constructor(
    readonly valueMoved: boolean,
    readonly valueVersion: number | null,
    readonly boundTo: readonly string[] | null,
  ) {}

  static set(
    valueVersion: number | null,
    boundTo: readonly string[],
  ): SecretChangeDetail {
    return new SecretChangeDetail(true, valueVersion, [...boundTo]);
  }

  static redefined(moved: {
    valueMoved: boolean;
    valueVersion: number | null;
    rebound: boolean;
    boundTo: readonly string[];
  }): SecretChangeDetail {
    return new SecretChangeDetail(
      moved.valueMoved,
      moved.valueMoved ? moved.valueVersion : null,
      moved.rebound ? [...moved.boundTo] : null,
    );
  }

  recorded(): RecordedDetail {
    return {
      ...(this.valueMoved ? { valueVersion: this.valueVersion } : {}),
      ...(this.boundTo ? { boundTo: this.boundTo } : {}),
    };
  }
}
