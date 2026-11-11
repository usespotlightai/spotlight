import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

@Injectable()
export class CauseCarrier {
  readonly #carried = new AsyncLocalStorage<unknown>();

  current(): unknown {
    return this.#carried.getStore() ?? null;
  }

  runWith<T>(cause: unknown, work: () => Promise<T>): Promise<T> {
    return this.#carried.run(cause, work);
  }
}
