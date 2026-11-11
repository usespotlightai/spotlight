import type { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import type { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import type { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';

export class StateVersion {
  private constructor(
    readonly id: StateVersionId,
    readonly number: number,
    readonly snapshot: StateSnapshot,
    readonly writtenBy: PrincipalRef,
    readonly writtenAt: Date,
  ) {}

  static of(input: {
    id: StateVersionId;
    number: number;
    snapshot: StateSnapshot;
    writtenBy: PrincipalRef;
    writtenAt: Date;
  }): StateVersion {
    return new StateVersion(
      input.id,
      input.number,
      input.snapshot,
      input.writtenBy,
      input.writtenAt,
    );
  }
}
