import type {
  SecretValueOrigin,
  SecretValueOriginKind,
} from '@secrets/domain/value-objects/secret-value-origin.vo';
import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export type SecretValueChange = 'stored' | 'handed-over';

export class SecretChangeDetail implements ChangeDetail {
  private constructor(
    readonly valueChange: SecretValueChange | null,
    readonly valueOrigin: SecretValueOriginKind | null,
    readonly valueVersion: number | null,
    readonly targets: readonly string[] | null,
  ) {}

  static created(created: {
    origin: SecretValueOrigin;
    valueVersion: number | null;
    targets: readonly string[];
  }): SecretChangeDetail {
    return new SecretChangeDetail(
      created.origin.awaitsValue ? null : 'stored',
      created.origin.kind,
      created.valueVersion,
      [...created.targets],
    );
  }

  static updated(moved: {
    valueChange: SecretValueChange | null;
    origin: SecretValueOrigin;
    valueVersion: number | null;
    rebound: boolean;
    targets: readonly string[];
  }): SecretChangeDetail {
    return new SecretChangeDetail(
      moved.valueChange,
      moved.valueChange ? moved.origin.kind : null,
      moved.valueChange ? moved.valueVersion : null,
      moved.rebound ? [...moved.targets] : null,
    );
  }

  recorded(): RecordedDetail {
    return {
      ...(this.valueChange ? { valueChange: this.valueChange } : {}),
      ...(this.valueOrigin ? { valueOrigin: this.valueOrigin } : {}),
      ...(this.valueVersion !== null
        ? { valueVersion: this.valueVersion }
        : {}),
      ...(this.targets ? { targets: this.targets } : {}),
    };
  }
}
