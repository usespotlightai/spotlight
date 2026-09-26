import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';

@Injectable()
export class AmbientCausation implements CausationPort {
  private readonly ambient = new AsyncLocalStorage<CausalChain>();

  current(): CausalChain {
    return this.ambient.getStore() ?? CausalChain.none();
  }

  within<T>(chain: CausalChain, work: () => Promise<T>): Promise<T> {
    return this.ambient.run(chain, work);
  }
}
