import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type {
  ErrorAbout,
  ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { OwesWork } from '@shared-kernel/domain/owes-work';

type WorkIds = Omit<ErrorAbout, 'source'>;

export interface OwedWorkSource<Owing extends OwesWork<Owing>, Key> {
  readonly name: string;
  readonly maxAtOnce: number;
  due(now: Date): Promise<Owing | null>;
  find(key: Key): Promise<Owing | null>;
  save(owing: Owing): Promise<void>;
  keyOf(owing: Owing): Key;
  ids(owing: Owing): WorkIds;
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
    private readonly reports: ErrorReportsPort,
  ) {}

  async workDue(): Promise<void> {
    while (this.#working.size < this.source.maxAtOnce) {
      const claimed = await this.claim();

      if (claimed === null) {
        return;
      }

      if (claimed.gaveUp) {
        this.reports.report(
          new Error(
            `${this.source.name}: gave up on work that kept being interrupted`,
          ),
          this.aboutError(claimed.gaveUp),
        );
      }

      const working: Promise<void> = this.workOn(claimed.key).finally(() =>
        this.#working.delete(working),
      );
      this.#working.add(working);
    }
  }

  async idle(): Promise<void> {
    await Promise.all([...this.#working]);
  }

  private claim(): Promise<{ key: Key; gaveUp: Owing | null } | null> {
    return this.transaction.inTransaction(async () => {
      const now = this.clock.now();
      const due = await this.source.due(now);

      if (!due) {
        return null;
      }

      if (due.workExhausted) {
        this.logger.warn(
          this.described(due),
          `${this.source.name}: giving up on work that kept being interrupted`,
        );
        await this.source.save(due.gaveUp(now));
        return { key: this.source.keyOf(due), gaveUp: due };
      }

      await this.source.save(due.leased(now));
      return { key: this.source.keyOf(due), gaveUp: null };
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
        { ...this.described(owing), err: error },
        this.source.name,
      );

      if (this.source.stale(error)) {
        return;
      }

      const later = owing.triedAgainLater(this.clock.now());

      await this.source
        .save(later)
        .catch((failure: unknown) =>
          this.logger.error(
            { ...this.described(owing), err: failure },
            `${this.source.name}: putting work back for later`,
          ),
        );

      if (!later.owesWork) {
        this.reports.report(error, this.aboutError(owing));
      }
    }
  }

  private described(owing: Owing): Record<string, unknown> {
    return { ...this.source.ids(owing), ...this.source.about(owing) };
  }

  private aboutError(owing: Owing): ErrorAbout {
    return { source: this.source.name, ...this.source.ids(owing) };
  }
}
