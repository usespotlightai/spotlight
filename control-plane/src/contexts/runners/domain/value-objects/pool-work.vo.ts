import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export type PoolWorkKind = 'run' | 'check';

export class PoolWork {
  private constructor(
    readonly kind: PoolWorkKind,
    readonly id: string,
  ) {}

  static run(id: string): PoolWork {
    return PoolWork.of('run', id);
  }

  static check(id: string): PoolWork {
    return PoolWork.of('check', id);
  }

  static of(kind: PoolWorkKind, id: string): PoolWork {
    if (id.trim().length === 0) {
      throw new InvalidIdentifierError(`pool ${kind}`);
    }

    return new PoolWork(kind, id);
  }

  equals(other: PoolWork): boolean {
    return this.kind === other.kind && this.id === other.id;
  }
}
