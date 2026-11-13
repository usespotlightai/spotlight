import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { MODEL_PRICES, type ModelPrices } from '@platform/llm/model-prices';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const REFRESH_EVERY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ModelPriceRefresh implements OnModuleInit, OnModuleDestroy {
  #timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(MODEL_PRICES) private readonly prices: ModelPrices,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  onModuleInit(): void {
    void this.refreshed();
    this.#timer = setInterval(() => void this.refreshed(), REFRESH_EVERY_MS);
    this.#timer.unref();
  }

  onModuleDestroy(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
    }
  }

  private async refreshed(): Promise<void> {
    try {
      await this.prices.refresh();
    } catch (error) {
      this.logger.warn(
        { error },
        'The model price catalog could not be read; calls without a reported cost stay unpriced',
      );
    }
  }
}
