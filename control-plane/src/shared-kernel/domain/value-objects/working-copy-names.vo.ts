import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

// The name of a store that the hosts' working copy hook keeps working copies in, such as s3://team-a.
// Spotlight does not read it: two pools or trusts with the same name share their working copies.
const STORE = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;

const MOST_STORE = 512;

// The name of a snapshot in a store, such as the base that new working copies start from.
const SNAPSHOT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export class WorkingCopyStoreName {
  private constructor(readonly value: string) {}

  static of(raw: string): WorkingCopyStoreName {
    if (raw.length > MOST_STORE || !STORE.test(raw)) {
      throw new InvalidIdentifierError(
        'working copy store',
        `must name the store the hosts' working copy hook reaches, such as s3://team-a: at most ${MOST_STORE} letters, digits and . _ : / @ + -, starting with a letter or digit`,
      );
    }

    return new WorkingCopyStoreName(raw);
  }

  equals(other: WorkingCopyStoreName | null): boolean {
    return other !== null && other.value === this.value;
  }
}

export class SnapshotName {
  private constructor(readonly value: string) {}

  static of(raw: string): SnapshotName {
    if (!SNAPSHOT.test(raw)) {
      throw new InvalidIdentifierError(
        'snapshot',
        'must be the name of a snapshot: 1 to 128 letters, digits, dots, dashes or underscores, starting with a letter or digit',
      );
    }

    return new SnapshotName(raw);
  }

  static same(one: SnapshotName | null, other: SnapshotName | null): boolean {
    return one === null ? other === null : one.equals(other);
  }

  equals(other: SnapshotName | null): boolean {
    return other !== null && other.value === this.value;
  }
}
