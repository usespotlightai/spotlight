import type { IssuedTokens } from '@identity/application/services/issued-tokens.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 60_000;

@Injectable()
export class ExpiredTokensWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly issuedTokens: IssuedTokens,
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

    this.#ticking = this.expireDue();
    await this.#ticking;
    this.#ticking = null;
  }

  private async expireDue(): Promise<void> {
    try {
      await this.issuedTokens.expireDue();
    } catch (error) {
      this.logger.error({ err: error }, this.issuedTokens.name);
    }
  }
}
