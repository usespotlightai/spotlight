import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { OwesWork } from '@shared-kernel/domain/owes-work';

export interface OwedWorkSource<Owing extends OwesWork<Owing>, Key> {
  readonly name: string;
  readonly mostAtOnce: number;
  due(now: Date): Promise<Owing | null>;
  find(key: Key): Promise<Owing | null>;
  save(owing: Owing): Promise<void>;
  keyOf(owing: Owing): Key;
  about(owing: Owing): Record<string, unknown>;
  worked(owing: Owing): Promise<Owing>;
  stale(error: unknown): boolean;
}

export class OwedWorkPool<Owing extends OwesWork<Owing>, Key> {
  readonly #working = new Set<Promise<void>>();

  constructor(
    private readonly source: OwedWorkSource<Owing, Key>,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async workDue(): Promise<void> {
    while (this.#working.size < this.source.mostAtOnce) {
      const claimed = await this.claim();

      if (claimed === null) {
        return;
      }

      const working: Promise<void> = this.workOn(claimed).finally(() =>
        this.#working.delete(working),
      );
      this.#working.add(working);
    }
  }

  async idle(): Promise<void> {
    await Promise.all([...this.#working]);
  }

  private claim(): Promise<Key | null> {
    return this.transaction.run(async () => {
      const now = this.clock.now();
      const due = await this.source.due(now);

      if (!due) {
        return null;
      }

      if (due.workExhausted) {
        this.logger.warn(
          this.source.about(due),
          `${this.source.name}: giving up on work that kept being interrupted`,
        );
        await this.source.save(due.gaveUp(now));
        return this.source.keyOf(due);
      }

      await this.source.save(due.leased(now));
      return this.source.keyOf(due);
    });
  }

  private async workOn(key: Key): Promise<void> {
    let owing: Owing | null;

    try {
      owing = await this.source.find(key);
    } catch (error) {
      this.logger.error(
        { err: error },
        `${this.source.name}: reading claimed work`,
      );
      return;
    }

    if (owing?.owesWork) {
      await this.attempt(owing);
    }
  }

  private async attempt(owing: Owing): Promise<void> {
    try {
      await this.source.save(await this.source.worked(owing));
    } catch (error) {
      this.logger.error(
        { ...this.source.about(owing), err: error },
        this.source.name,
      );

      if (this.source.stale(error)) {
        return;
      }

      await this.source
        .save(owing.triedAgainLater(this.clock.now()))
        .catch((settling: unknown) =>
          this.logger.error(
            { ...this.source.about(owing), err: settling },
            `${this.source.name}: putting work back for later`,
          ),
        );
    }
  }
}
