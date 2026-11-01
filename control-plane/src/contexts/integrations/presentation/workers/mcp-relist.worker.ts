import type { RelistServers } from '@integrations/application/services/relist-servers.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 60_000;

@Injectable()
export class McpRelistWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly servers: RelistServers,
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

    this.#ticking = this.relist();
    await this.#ticking;
    this.#ticking = null;
  }

  private async relist(): Promise<void> {
    try {
      await this.servers.processDue();
    } catch (error) {
      this.logger.error({ err: error }, 'Listing MCP servers again');
    }
  }
}
