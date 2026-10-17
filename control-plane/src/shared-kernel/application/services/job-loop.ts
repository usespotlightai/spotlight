import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type {
  ErrorAbout,
  ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';

type JobIds = Omit<ErrorAbout, 'source'>;

export interface JobSource<Job extends HasPendingJob<Job>, Key> {
  readonly name: string;
  readonly batchSize: number;
  due(now: Date): Promise<Job | null>;
  find(key: Key): Promise<Job | null>;
  save(job: Job): Promise<void>;
  keyOf(job: Job): Key;
  ids(job: Job): JobIds;
  about(job: Job): Record<string, unknown>;
  process(job: Job): Promise<Job>;
  stale(error: unknown): boolean;
}

export class JobLoop<Job extends HasPendingJob<Job>, Key> {
  readonly #running = new Set<Promise<void>>();

  constructor(
    private readonly source: JobSource<Job, Key>,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly reports: ErrorReportsPort,
  ) {}

  async processDue(): Promise<void> {
    while (this.#running.size < this.source.batchSize) {
      const leased = await this.leaseNext();

      if (leased === null) {
        return;
      }

      if (leased.deadLettered) {
        this.reports.report(
          new Error(
            `${this.source.name}: dead-lettered a job that kept being interrupted`,
          ),
          this.aboutError(leased.deadLettered),
        );
      }

      const running: Promise<void> = this.run(leased.key).finally(() =>
        this.#running.delete(running),
      );
      this.#running.add(running);
    }
  }

  async idle(): Promise<void> {
    await Promise.all([...this.#running]);
  }

  private leaseNext(): Promise<{ key: Key; deadLettered: Job | null } | null> {
    return this.transaction.inTransaction(async () => {
      const now = this.clock.now();
      const due = await this.source.due(now);

      if (!due) {
        return null;
      }

      if (due.jobExhausted) {
        this.logger.warn(
          this.described(due),
          `${this.source.name}: dead-lettering a job that kept being interrupted`,
        );
        await this.source.save(due.deadLetter(now));
        return { key: this.source.keyOf(due), deadLettered: due };
      }

      await this.source.save(due.leaseJob(now));
      return { key: this.source.keyOf(due), deadLettered: null };
    });
  }

  private async run(key: Key): Promise<void> {
    let job: Job | null;

    try {
      job = await this.source.find(key);
    } catch (error) {
      this.logger.error(
        { err: error },
        `${this.source.name}: reading a leased job`,
      );
      return;
    }

    if (job?.hasPendingJob) {
      await this.attempt(job);
    }
  }

  private async attempt(job: Job): Promise<void> {
    try {
      await this.source.save(await this.source.process(job));
    } catch (error) {
      this.logger.error(
        { ...this.described(job), err: error },
        this.source.name,
      );

      if (this.source.stale(error)) {
        return;
      }

      const later = job.scheduleRetry(this.clock.now());

      await this.source
        .save(later)
        .catch((failure: unknown) =>
          this.logger.error(
            { ...this.described(job), err: failure },
            `${this.source.name}: scheduling a retry`,
          ),
        );

      if (!later.hasPendingJob) {
        this.reports.report(error, this.aboutError(job));
      }
    }
  }

  private described(job: Job): Record<string, unknown> {
    return { ...this.source.ids(job), ...this.source.about(job) };
  }

  private aboutError(job: Job): ErrorAbout {
    return { source: this.source.name, ...this.source.ids(job) };
  }
}
