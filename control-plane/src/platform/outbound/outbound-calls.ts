import diagnostics from 'node:diagnostics_channel';

import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { fieldOf } from '@platform/json/field-of';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

const requestIn = (message: unknown): object | null => {
  const request = fieldOf(message, 'request');

  return typeof request === 'object' && request !== null ? request : null;
};

const CREATED = 'undici:request:create';
const ANSWERED = 'undici:request:headers';
const FAILED = 'undici:request:error';

const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;

const hostOf = (origin: string | undefined): string | undefined => {
  try {
    return nonEmpty(origin) ? new URL(origin).host : undefined;
  } catch {
    return undefined;
  }
};

// Paths and queries can carry secrets, such as the token in a webhook URL. Lines name the host only.
@Injectable()
export class OutboundCalls implements OnModuleInit, OnModuleDestroy {
  readonly #started = new WeakMap<object, number>();

  constructor(@Inject(LOGGER) private readonly logger: LoggerPort) {}

  readonly #created = (message: unknown): void => {
    const request = requestIn(message);

    if (request !== null) {
      this.#started.set(request, performance.now());
    }
  };

  readonly #answered = (message: unknown): void => {
    const request = requestIn(message);
    const statusCode = fieldOf(fieldOf(message, 'response'), 'statusCode');

    if (request === null || typeof statusCode !== 'number') {
      return;
    }

    const call = { ...this.described(request), status: statusCode };

    if (statusCode === TOO_MANY_REQUESTS || statusCode >= SERVER_ERROR) {
      this.logger.warn({ outbound: call }, 'Outbound call refused');
      return;
    }

    this.logger.debug({ outbound: call }, 'Outbound call');
  };

  readonly #failed = (message: unknown): void => {
    const request = requestIn(message);

    if (request === null) {
      return;
    }

    this.logger.warn(
      { outbound: this.described(request), err: fieldOf(message, 'error') },
      'Outbound call failed',
    );
  };

  onModuleInit(): void {
    diagnostics.subscribe(CREATED, this.#created);
    diagnostics.subscribe(ANSWERED, this.#answered);
    diagnostics.subscribe(FAILED, this.#failed);
  }

  onModuleDestroy(): void {
    diagnostics.unsubscribe(CREATED, this.#created);
    diagnostics.unsubscribe(ANSWERED, this.#answered);
    diagnostics.unsubscribe(FAILED, this.#failed);
  }

  private described(request: object): Record<string, unknown> {
    const started = this.#started.get(request);
    const origin = fieldOf(request, 'origin');

    return {
      host: hostOf(typeof origin === 'string' ? origin : undefined),
      method: fieldOf(request, 'method'),
      durationMs:
        started === undefined
          ? undefined
          : Math.round(performance.now() - started),
    };
  }
}
