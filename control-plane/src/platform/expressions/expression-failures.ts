import diagnostics from 'node:diagnostics_channel';
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  EXPRESSION_FAILED,
  type ExpressionFailure,
} from '@platform/expressions/readings';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { OncePer } from '@shared-kernel/application/services/once-per';

const NOTED_FOR_MS = 10 * 60_000;

@Injectable()
export class ExpressionFailures implements OnModuleInit, OnModuleDestroy {
  readonly #noted = new OncePer(NOTED_FOR_MS);

  constructor(
    @Inject(LOGGER) private readonly logger: LoggerPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  readonly #failed = (message: unknown): void => {
    const { location, error } = message as ExpressionFailure;
    if (!this.#noted.due(`${location ?? ''}\n${error}`, this.clock.now())) {
      return;
    }

    this.logger.warn(
      { location, error },
      'An expression failed, so it read as false or empty',
    );
  };

  onModuleInit(): void {
    diagnostics.subscribe(EXPRESSION_FAILED, this.#failed);
  }

  onModuleDestroy(): void {
    diagnostics.unsubscribe(EXPRESSION_FAILED, this.#failed);
  }
}
