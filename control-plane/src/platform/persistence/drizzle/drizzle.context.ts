import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { BackgroundPort } from '@shared-kernel/application/ports/background.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

interface Ambient {
  readonly db: DrizzleDatabase;
  readonly committed: (() => void)[];
}

@Injectable()
export class DrizzleContext implements TransactionPort, BackgroundPort {
  private readonly ambient = new AsyncLocalStorage<Ambient>();

  constructor(@Inject(DRIZZLE) private readonly root: DrizzleDatabase) {}

  get db(): DrizzleDatabase {
    return this.ambient.getStore()?.db ?? this.root;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.ambient.getStore()) {
      return work();
    }

    const committed: (() => void)[] = [];
    const result = await this.root.transaction((tx) =>
      this.ambient.run(
        { db: tx as unknown as DrizzleDatabase, committed },
        work,
      ),
    );

    for (const each of committed) {
      each();
    }

    return result;
  }

  start(work: () => Promise<void>): void {
    void this.ambient.exit(work);
  }

  afterCommit(then: () => void): void {
    const held = this.ambient.getStore();

    if (held) {
      held.committed.push(then);
    } else {
      then();
    }
  }
}
