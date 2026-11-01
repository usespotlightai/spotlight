import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { SavepointPort } from '@shared-kernel/application/ports/savepoint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

interface AsyncLocal {
  readonly db: DrizzleDatabase;
  readonly committed: (() => void)[];
}

@Injectable()
export class DrizzleContext implements TransactionPort, SavepointPort {
  private readonly asyncLocal = new AsyncLocalStorage<AsyncLocal>();

  constructor(@Inject(DRIZZLE) private readonly root: DrizzleDatabase) {}

  get db(): DrizzleDatabase {
    return this.asyncLocal.getStore()?.db ?? this.root;
  }

  get transacting(): boolean {
    return this.asyncLocal.getStore() !== undefined;
  }

  async inTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.asyncLocal.getStore()) {
      return work();
    }

    const committed: (() => void)[] = [];
    const result = await this.root.transaction((tx) =>
      this.asyncLocal.run(
        { db: tx as unknown as DrizzleDatabase, committed },
        work,
      ),
    );

    for (const each of committed) {
      each();
    }

    return result;
  }

  async inSavepoint<T>(work: () => Promise<T>): Promise<T> {
    const current = this.asyncLocal.getStore();

    if (!current) {
      return this.inTransaction(work);
    }

    const committed: (() => void)[] = [];
    const result = await current.db.transaction((savepoint) =>
      this.asyncLocal.run(
        { db: savepoint as unknown as DrizzleDatabase, committed },
        work,
      ),
    );

    current.committed.push(...committed);

    return result;
  }

  afterCommit(then: () => void): void {
    const current = this.asyncLocal.getStore();

    if (current) {
      current.committed.push(then);
    } else {
      then();
    }
  }
}
