import type { RecordPullRequests } from '@github/application/services/record-pull-requests.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 60 * 60_000;

const PURGING = 'Purging pull requests past retention';

@Injectable()
export class PurgePullRequestsWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly recording: RecordPullRequests,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#ticking;
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    if (this.#ticking || this.#stopped) {
      return;
    }

    this.#ticking = this.purge();
    await this.#ticking;
    this.#ticking = null;
  }

  private async purge(): Promise<void> {
    try {
      await this.recording.pastRetention();
    } catch (error) {
      this.logger.error({ err: error }, PURGING);
    }
  }
}
