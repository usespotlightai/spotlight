import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';

@Injectable()
export class AsyncLocalCausation implements CausationPort {
  private readonly asyncLocal = new AsyncLocalStorage<CausalChain>();

  current(): CausalChain {
    return this.asyncLocal.getStore() ?? CausalChain.none();
  }

  runWith<T>(chain: CausalChain, work: () => Promise<T>): Promise<T> {
    return this.asyncLocal.run(chain, work);
  }
}
