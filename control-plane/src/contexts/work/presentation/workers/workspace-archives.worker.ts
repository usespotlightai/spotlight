import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RemoveReleasedArchives } from '@work/application/services/remove-released-archives.service';

const EVERY_MS = 60_000;

@Injectable()
export class WorkspaceArchivesWorker implements OnModuleDestroy {
  #turning: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly released: RemoveReleasedArchives,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#turning;
  }

  @Interval(EVERY_MS)
  async turn(): Promise<void> {
    if (this.#turning || this.#stopped) {
      return;
    }

    this.#turning = this.removed();
    await this.#turning;
    this.#turning = null;
  }

  private async removed(): Promise<void> {
    try {
      await this.released.workDue();
    } catch (error) {
      this.logger.error({ err: error }, this.released.name);
    }
  }
}
