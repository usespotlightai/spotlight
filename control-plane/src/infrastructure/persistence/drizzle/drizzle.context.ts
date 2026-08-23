import { AsyncLocalStorage } from 'node:async_hooks';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DrizzleContext implements TransactionPort {
  private readonly ambient = new AsyncLocalStorage<DrizzleDatabase>();

  constructor(@Inject(DRIZZLE) private readonly root: DrizzleDatabase) {}

  get db(): DrizzleDatabase {
    return this.ambient.getStore() ?? this.root;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.ambient.getStore()) {
      return work();
    }

    return this.root.transaction((tx) =>
      this.ambient.run(tx as unknown as DrizzleDatabase, work),
    );
  }
}
