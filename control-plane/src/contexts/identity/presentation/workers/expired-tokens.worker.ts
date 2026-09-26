import type { MintedTokens } from '@identity/application/services/minted-tokens.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 60_000;

@Injectable()
export class ExpiredTokensWorker implements OnModuleDestroy {
  #turning: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly minted: MintedTokens,
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

    this.#turning = this.pruned();
    await this.#turning;
    this.#turning = null;
  }

  private async pruned(): Promise<void> {
    try {
      await this.minted.pruneExpired();
    } catch (error) {
      this.logger.error({ err: error }, this.minted.name);
    }
  }
}
