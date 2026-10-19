import diagnostics from 'node:diagnostics_channel';
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

type UndiciRequest = { readonly origin?: string; readonly method?: string };
type Created = { readonly request: UndiciRequest };
type Answered = Created & {
  readonly response: { readonly statusCode: number };
};
type Failed = Created & { readonly error: unknown };

const CREATED = 'undici:request:create';
const ANSWERED = 'undici:request:headers';
const FAILED = 'undici:request:error';

const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;

const hostOf = (origin: string | undefined): string | undefined => {
  try {
    return origin ? new URL(origin).host : undefined;
  } catch {
    return undefined;
  }
};

// Paths and queries can carry secrets, such as the token in a webhook URL. Lines name the host only.
@Injectable()
export class OutboundCalls implements OnModuleInit, OnModuleDestroy {
  readonly #started = new WeakMap<UndiciRequest, number>();

  constructor(@Inject(LOGGER) private readonly logger: LoggerPort) {}

  readonly #created = (message: unknown): void => {
    this.#started.set((message as Created).request, performance.now());
  };

  readonly #answered = (message: unknown): void => {
    const { request, response } = message as Answered;
    const call = { ...this.described(request), status: response.statusCode };

    if (
      response.statusCode === TOO_MANY_REQUESTS ||
      response.statusCode >= SERVER_ERROR
    ) {
      this.logger.warn({ outbound: call }, 'Outbound call refused');
      return;
    }

    this.logger.debug({ outbound: call }, 'Outbound call');
  };

  readonly #failed = (message: unknown): void => {
    const { request, error } = message as Failed;

    this.logger.warn(
      { outbound: this.described(request), err: error },
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

  private described(request: UndiciRequest): Record<string, unknown> {
    const started = this.#started.get(request);

    return {
      host: hostOf(request.origin),
      method: request.method,
      durationMs:
        started === undefined
          ? undefined
          : Math.round(performance.now() - started),
    };
  }
}
