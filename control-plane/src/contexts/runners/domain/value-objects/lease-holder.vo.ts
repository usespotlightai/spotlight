import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const LEASE_HOLDER_KINDS = ['run', 'editor', 'archive'] as const;

export type LeaseHolderKind = (typeof LEASE_HOLDER_KINDS)[number];

export class LeaseHolder {
  private constructor(
    readonly kind: LeaseHolderKind,
    readonly id: string,
  ) {}

  static run(runId: RunId): LeaseHolder {
    return new LeaseHolder('run', runId.value);
  }

  static archive(runId: RunId): LeaseHolder {
    return new LeaseHolder('archive', runId.value);
  }

  static editor(connection: string): LeaseHolder {
    return LeaseHolder.of('editor', connection);
  }

  static of(kind: string, id: string): LeaseHolder {
    const known = LEASE_HOLDER_KINDS.find((each) => each === kind);

    if (!known) {
      throw new InconsistentStateError(
        'sandbox lease',
        `has a holder of an unknown kind (${kind})`,
      );
    }

    if (id.trim().length === 0) {
      throw new InconsistentStateError('sandbox lease', 'has no holder');
    }

    return new LeaseHolder(known, id);
  }

  get isRun(): boolean {
    return this.kind === 'run';
  }

  get isEditor(): boolean {
    return this.kind === 'editor';
  }

  get isArchive(): boolean {
    return this.kind === 'archive';
  }

  equals(other: LeaseHolder): boolean {
    return this.kind === other.kind && this.id === other.id;
  }
}
